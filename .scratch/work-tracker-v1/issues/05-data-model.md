# 05: Data model

**Type:** grilling
**Status:** open
**Blocked by:** 03, 04

## Question

What are the tables and key fields for Category, Entry, Meeting series, Meeting exception and skipped date, Absence, Workday location, and Settings? How do we store times (local or UTC) and handle a change of work hours or time zone for past days? How does the schema version and migration work?

Also decide here: the SQLite route (`rusqlite` or the Tauri SQL plugin), and where recurrence expansion lives (TypeScript or Rust), because the export runs in Rust. Ask the user if they want an ADR for each choice.
