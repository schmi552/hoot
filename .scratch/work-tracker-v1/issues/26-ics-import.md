# 26: `.ics` import

**What to build:** The user imports an `.ics` file into the calendar.

**Blocked by:** 22 Meetings and recurrence

**Status:** resolved

- [x] `ical.js` parses the file.
- [x] The import keeps RRULE, changed occurrences (`RECURRENCE-ID`) as overrides, and cancelled dates (`EXDATE`) as skips, in our own tables.
- [x] Time zones convert to local time. The import maps known Windows zone names to IANA names and warns the user about any zone it cannot map.
- [x] The user picks a Category for the whole import or for each Meeting.
- [x] TypeScript tests use sample `.ics` files, including a `TZID` with no `VTIMEZONE`.
