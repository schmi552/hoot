# 01: Product scope and behaviour

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

What is in v1, which words do we use, and how does the app behave day to day?

## Answer

- **Destination:** the map ends in a reviewed v1 spec.
- **Scope:** v1 core is onboarding, popup, week and month calendar, Entry create/move/resize/copy/duplicate/delete by hotkey, and Excel export. Absences, recurring Meetings and `.ics` import are mapped now and built after the core. Full Google/Apple parity is out of scope.
- **Platforms and stack:** macOS and Windows. React with TypeScript inside Tauri.
- **Vocabulary:** Category, Entry, Meeting, Absence, Workday location (see `GLOSSARY.md`).
- **Popup:** looks backward. An answer becomes an Entry from the end of the previous Entry to now, minus lunch, time outside work hours, and Meetings. "Still doing that?" extends the last Entry. A missed tick shows one gap: accept it, split it, or leave it empty. No popup outside work hours or during lunch. The first popup of the day asks for home or office.
- **Calendar:** Entries snap to 15 minutes. Popup Entries keep minute precision. Entries never overlap each other. A manual Entry may overlap a Meeting.
- **Export:** one workbook for a chosen timeframe. Sheet 1 has one row per Entry, Meeting and Absence (date, start, end, duration, category, description, location). Sheet 2 has hours per Category per day plus the Workday location for each day.
- **Recurrence and import:** store one RRULE per recurring Meeting and expand it at display time. A changed occurrence is an exception. A deleted occurrence is a skipped date. `.ics` import is a one-time copy with RRULE, exceptions and cancelled dates. Time zones convert to local time. The user picks a Category per import or per Meeting.
- **Absences:** no popup during a full-day Absence, and none during the absent hours of a partial one. Absences are separate rows in the export and do not count as logged work hours. A daily total against expected working time is shown.
- **Lifecycle:** tray app that starts at login. The popup is its own small window with snooze and skip. Closing the main window hides it to the tray.
- **Data:** one local SQLite file in the app-data folder, no encryption, no sync, manual backup, versioned schema, menu item to reveal the file.
- **Mascot:** original pixel-art character in the popup and in empty states only. Art is decided later.
- **Settings:** onboarding values are editable at any time and apply going forward. A Category with Entries is archived, not deleted.
