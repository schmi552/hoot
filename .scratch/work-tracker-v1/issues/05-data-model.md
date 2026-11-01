# 05: Data model

**Type:** grilling
**Status:** resolved
**Blocked by:** 03, 04

## Question

What are the tables and key fields for Category, Entry, Meeting series, Meeting exception and skipped date, Absence, Workday location, and Settings? How do we store times (local or UTC) and handle a change of work hours or time zone for past days? How does the schema version and migration work?

Also decide here: the SQLite route (`rusqlite` or the Tauri SQL plugin), and where recurrence expansion lives (TypeScript or Rust), because the export runs in Rust. Ask the user if they want an ADR for each choice.

## Answer

Decided with the user in two grilling rounds. Three ADRs record the hard-to-reverse choices: `docs/adr/0001-rusqlite-in-rust.md`, `0002-recurrence-expansion-in-typescript.md`, `0003-utc-instants-with-iana-zone.md`.

- **SQLite route:** `rusqlite` with `rusqlite_migration`. React calls Tauri commands and never runs SQL.
- **Recurrence expansion:** TypeScript only (`rrule-temporal`). The export command receives expanded rows from the UI. Rust writes the workbook.
- **Time storage:** UTC epoch seconds plus an IANA zone per row. Recurring Meetings store local wall-clock start plus zone. Full-day Absences store local dates.
- **Work hours history:** `settings_history` rows with an effective-from date. A past day uses the hours that were true on that day.
- **Keys:** integer primary keys everywhere. The "Entries never overlap" rule is checked in app code, not by a database constraint.
- **Tables:**
  - `category`: `id`, `name` (unique, one free-text field), `archived_at`.
  - `entry`: `id`, `category_id`, `description`, `start_utc`, `end_utc`, `tz`.
  - `meeting_series`: `id`, `category_id`, `title`, `start_local`, `duration_minutes`, `tz`, `rrule` (null for a one-off), `source` (`manual` or `ics`), `ics_uid`.
  - `meeting_exception`: `series_id`, `original_start_local`, `kind` (`skip` or `override`), nullable override fields (`start_local`, `duration_minutes`, `title`, `category_id`). Primary key `(series_id, original_start_local)`.
  - `absence`: `id`, `label` (free text), `all_day`. Full-day uses `start_date` and `end_date` (inclusive). Part-day uses `start_utc`, `end_utc`, `tz`.
  - `workday_location`: `date` (primary key), `location` (`home` or `office`). No row means the first popup has not answered yet.
  - `settings_history`: `effective_from` (primary key), `work_start`, `work_end`, `lunch_start`, `lunch_end`, `tz`, popup interval.
  - `app_setting`: key and value for settings with no history (for example autostart, snooze length).
- **Schema version:** `PRAGMA user_version` with `rusqlite_migration`. Migrations go forward only and run at startup. The app copies the database to a `.bak` file before it migrates. It refuses to open a file with a newer version than it knows.
