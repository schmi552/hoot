# 25: Export Meetings and Absences

**What to build:** The workbook also lists Meetings and Absences.

**Blocked by:** 19 Excel export, 22 Meetings and recurrence, 24 Absences

**Status:** resolved

- [x] Sheet 1 has one row per Meeting next to the Entry rows, with the same columns. A full-day Absence has one row per day inside the timeframe; a part-day Absence has one row on its start day. Absence rows use the category "Absence (not worked)" and have an empty Hours cell (ADR 0011).
- [x] The UI expands recurring Meetings and sends the rows. The export matches the calendar.
- [x] Absence rows do not count as logged hours in sheet 2, and the Hours cell of an Absence row is empty.
- [x] Rust command tests check the extra rows.
