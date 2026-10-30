# 17: Workday location

**What to build:** The first popup of the day asks if the user works from home or in the office. The calendar shows the answer.

**Blocked by:** 16 Popup with the backward-looking rule

**Status:** resolved

- [x] The `workday_location` table exists. No row means the question is not answered yet.
- [x] The first popup of the day shows the location step. H picks Home and O picks Office.
- [x] The week and month views show the location of each day.
