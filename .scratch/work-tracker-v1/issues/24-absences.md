# 24: Absences

**What to build:** The user records sick days, vacation and hours off.

**Blocked by:** 15 Month view, 16 Popup with the backward-looking rule

**Status:** resolved

- [x] The `absence` table exists.
- [x] The Absence dialog has a label, all-day or part-day, and a date range. A drag on the all-day row creates a full-day Absence.
- [x] Full-day Absences store local dates. Part-day Absences store UTC times and a zone.
- [x] No popup shows during an Absence. The popup span and the Gap computation cut Absences out.
- [x] Absence hours reduce the expected time. Absences do not count as logged hours.
- [x] TypeScript tests cover the daily total with an Absence.
