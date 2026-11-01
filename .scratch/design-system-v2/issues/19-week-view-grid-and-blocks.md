# 19: Week view grid and blocks

**What to build:** The week grid matches the week board. It has 64 px per hour. The range runs from work start minus one hour to work end plus one hour, and widens in full hours to show any item outside. The grid shows the Workdays, and also a non-workday that holds an Entry, Meeting or Absence. An Entry shows in the tint of its Category, with a grip and a selected ring. Its text depends on its length: one line at 15 minutes or less, the title at 30 minutes, and the title plus "code · time" at 45 minutes or more. A Meeting has a dashed outline and a repeat icon. A Meeting without a Category is neutral (gray, dashed). An Absence has a hatch and a label chip. The weekly total with Expected counts Entries only.

Spec stories: 75 to 81, 83.

**Blocked by:** 08, 09, 10, 11, 18

**Status:** done

- [x] Vitest tests cover the days to show and the grid range with its widening.
- [x] Vitest tests cover the Entry text rule at 15, 30 and 45 minutes.
- [x] The three item kinds are different at a glance, in light and dark.
- [x] Totals do not count Meetings.
- [x] The grid matches the week board for the 29 October 2026 data.
