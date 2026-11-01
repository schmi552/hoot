# Map: Work Tracker v1

## Destination

A reviewed v1 spec for the Work Tracker, ready for `/to-tickets`. It covers the data model, the popup flow, the calendar behaviour, the export format and the tech choices. No app code is written during mapping.

## Notes

- Greenfield repo. There is no code to survey, so there are no integration points yet.
- Domain words are in `GLOSSARY.md`: Category, Entry, Meeting, Absence, Workday location. Use them unchanged.
- Stack: Tauri (macOS and Windows), React with TypeScript, local SQLite. Source: `docs/project_outline.md`.
- Write in ASD-STE100 style, as set in `CLAUDE.md`. Ask about an ADR when a decision is hard to reverse (see `CLAUDE.md`).
- v1 core is onboarding, popup, week and month calendar, Entry editing with hotkeys, and Excel export. Absences, recurring Meetings and `.ics` import are mapped now but built after the core.

## Decisions so far

- [Product scope and behaviour](issues/01-product-scope-and-behaviour.md): v1 scope, vocabulary, backward-looking popup, 15-minute snap, two-sheet export, recurrence as RRULE with exceptions, tray app, local SQLite.

- [Data model](issues/05-data-model.md): `rusqlite` in Rust, recurrence expanded in TypeScript only, UTC plus IANA zone per row, settings history by effective date, integer keys, eight tables, `user_version` migration with `.bak` copy. See ADRs 0001 to 0003.
- [Popup and mascot prototype](issues/06-popup-and-mascot-prototype.md): chat-style popup (variant D): mascot bubbles, steps for location, gap and work, recent chips, full keyboard flow, follows system light/dark.
- [Calendar UI library](issues/02-calendar-ui-library.md): FullCalendar v7 with `rrule` fits; we build per-occurrence exceptions and hotkeys ourselves.
- [Tauri capabilities](issues/03-tauri-capabilities.md): tray, autostart, popup window and hotkeys work; SQLite route (`rusqlite` or SQL plugin) is open; `rust_xlsxwriter` for Excel; sleep and wake needs a gap check.
- [iCalendar libraries](issues/04-icalendar-libraries.md): `ical.js` plus `rrule-temporal` in TypeScript; time zones are the main risk; exceptions go in our own tables.
- [Calendar interactions](issues/07-calendar-interactions.md): drag to create, keyboard move/resize/copy/duplicate/delete with undo, block overlaps, "+" menu for Meeting and Absence, "this Meeting only / all Meetings" dialog, daily total of Entries against expected time, single selection.
- [Sleep, wake and gap detection](issues/08-sleep-wake-gap-detection.md): wall-clock check in Rust, no OS hooks in v1; one gap popup on the current workday only, shown at once in work hours; accept, split or leave empty.
- [Error handling and data safety](issues/09-error-handling-and-data-safety.md): export through temp file and rename; daily `VACUUM INTO` backup, last 7 kept; failed migration rolls back and blocks start; `quick_check` with restore-from-backup or start-empty; failed saves keep the user's answer.

## Not yet specified

- Packaging, code signing, autostart registration and updates for macOS and Windows.
- Screen-by-screen onboarding flow and the settings screen.
- Test seams for the feature, which `/to-spec` must confirm with you.

## Out of scope

- Full parity with Google and Apple Calendar: invites, attendees, calendar sync and subscription. Reason: the destination is a personal time log.
- Linux, cloud storage, multi-user and encryption. Reason: stated as local-only and macOS plus Windows.
