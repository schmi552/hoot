# 21: Month view

**What to build:** The month view matches the month board. It shows all seven days, and non-workdays are shaded. Each cell shows the day number, a filled circle for today, the read-only location icon, the Absence bands, the day total and a Category share bar. Days outside the month show their data. A Week column at the right shows the total and the expected time of each week row. The week total counts all seven days of the row. The expected time is the sum over the row's Workdays. A weekend day shows a total and bar only when it has Entries. A click on a day opens that week. FullCalendar draws only the Absences. The Week column (fixed row height 148 px) and the cell bottom content (a React portal) are built by us, as the spike results from ticket 18 allow.

Spec stories: 93 to 99.

**Blocked by:** 08, 09, 10, 11, 18

**Status:** done

- [x] Vitest tests cover the week total, the expected time and the weekend bar rule.
- [x] The Week column lines up with the rows at 148 px.
- [x] A click on a day opens that week.
- [x] The view matches the month board in light and dark.
