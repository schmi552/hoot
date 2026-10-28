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

## Not yet specified

- Detecting sleep, wake and missed ticks on each operating system, so the gap popup fires correctly.
- Packaging, code signing, autostart registration and updates for macOS and Windows.
- Screen-by-screen onboarding flow and the settings screen.
- Test seams for the feature, which `/to-spec` must confirm with you.
- Error handling and data safety: failed export, corrupt database, schema migration.
- Absence creation in the calendar UI, and the daily total against expected working time.

## Out of scope

- Full parity with Google and Apple Calendar: invites, attendees, calendar sync and subscription. Reason: the destination is a personal time log.
- Linux, cloud storage, multi-user and encryption. Reason: stated as local-only and macOS plus Windows.
