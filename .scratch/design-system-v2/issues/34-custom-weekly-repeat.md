# 34: Custom weekly repeat for a Meeting

**What to build:** A Meeting could repeat daily, on weekdays, weekly or monthly. It could not repeat on, for example, Monday and Wednesday. The store and the calendar already read weekly rules with days. Only the form had no way to pick them.

**Blocked by:** 31

**Status:** done

- [x] The Repeat list has "On certain weekdays". It shows seven day chips under "Every week on". The weekday of the start is selected first.
- [x] Saving with no day selected shows an error.
- [x] `ruleFor("custom", days)` gives `FREQ=WEEKLY;BYDAY=…` with the days in Monday-first order. A test checks the rule, its text and the occurrences of a week.
- [x] Editing an existing Meeting does not change its repeat. This is the same as for the other choices.
