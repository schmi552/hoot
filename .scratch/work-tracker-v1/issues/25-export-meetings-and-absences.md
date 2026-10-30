# 25: Export Meetings and Absences

**What to build:** The workbook also lists Meetings and Absences.

**Blocked by:** 19 Excel export, 22 Meetings and recurrence, 24 Absences

**Status:** resolved

- [x] Sheet 1 has one row per Meeting and Absence next to the Entry rows, with the same columns.
- [x] The UI expands recurring Meetings and sends the rows. The export matches the calendar.
- [x] Absence rows do not count as logged hours in sheet 2.
- [x] Rust command tests check the extra rows.
