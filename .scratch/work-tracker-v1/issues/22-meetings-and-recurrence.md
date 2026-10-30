# 22: Meetings and recurrence

**What to build:** The user adds Meetings, including recurring Meetings, and they show in the calendar.

**Blocked by:** 14 Move, resize, copy and undo, 16 Popup with the backward-looking rule

**Status:** resolved

- [x] A "+" menu has Entry, Meeting and Absence (`N`, `M`, `A`). Absence is added in a later ticket.
- [x] The Meeting dialog has title, Category, start, duration and repeat: none, daily, weekdays, weekly, monthly.
- [x] The `meeting_series` and `meeting_exception` tables exist. TypeScript expands the rule with `rrule-temporal` for the visible range. A Meeting stays at the same local time across a DST change.
- [x] Meetings show in the calendar and never block an Entry.
- [x] The popup span and the Gap computation cut Meetings out. No popup shows during a Meeting.
- [x] A copied Meeting pastes as a normal Entry with the same Category and description.
- [x] TypeScript tests cover expansion and DST.
