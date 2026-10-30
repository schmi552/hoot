# 23: Edit one Meeting occurrence

**What to build:** The user changes or deletes one occurrence of a recurring Meeting.

**Blocked by:** 22 Meetings and recurrence

**Status:** resolved

- [x] A dialog asks "This Meeting only" or "All Meetings".
- [x] "This Meeting only" writes a skip or an override in `meeting_exception`. "All Meetings" changes the series.
- [x] No "this and following" option.
- [x] TypeScript tests cover skip and override.
