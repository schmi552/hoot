# 35: Dropdown pickers for times and minutes in Settings

**What to build:** The Work time fields used the native `time` input, one text box for lunch ("12:00 · 30 min") and four chips for the check-in interval. Replace them with one picker that works the same way everywhere. The same picker is used in Onboarding.

**Blocked by:** none

**Status:** done

- [x] `TimeField` shows a list with a time every 15 minutes. The user can also type a time ("7:05", "0705"). A bad text goes back to the last good value.
- [x] `MinutesField` shows a list of minute options. The user can also type any whole number of minutes.
- [x] Lunch is `TimeSpanField`: a start time and a length in minutes, in two boxes under one label. This replaces the one-box lunch text.
- [x] "Check-in every" is a `MinutesField`. This replaces the interval chips.
- [x] The lists open downwards. A category list can open downwards too (`down` on `CategoryCombo`).
- [x] `parseTime` and `parseMinutes` have tests. The tests for the removed lunch text and the nearest chip are gone with their code.
