# Change the calendar toolbar from the board, and load a window of data

Amends ADR 0021 for one screen. The boards stay the source of truth. For the calendar toolbar, the user decided on a different layout after seeing the app. The board does not show these changes. They are deliberate, and a screenshot check must not call them bugs.

The toolbar has the logo, the Today button, the arrows and the title on the left. On the right it has a Week and Month toggle, a "+ New" button and a "…" menu.
- Week and Month are one joined toggle (a segmented control), not two chips. The shortcuts W and M stay.
- "+ New" is a primary chip with the height of the toggle. It was a round blue "+" button.
- The "…" menu holds Export, Settings and Quit. They were three separate buttons. The menu is a plain list of rows, not chips.
- The title is a button. A click opens a date field to go to any week or month.
- The debug buttons stay dev-only and sit in a small fixed bar at the bottom right, so they do not break the toolbar row.

The week grid and the month grid scroll inside the window. The toolbar, the banner and the day headers stay in place.

For speed, the calendar loads the Entries and the Workday locations of a window of six weeks on each side of the shown range, in one request. A switch to a near week or month needs no new request, and an empty week shows its message at once. Date formatters are built once and reused, because making one costs much more than using one.

We did not move the navigation above the calendar grid, because the user did not like it. We did not build our own Month grid, because the measured cost was in our date code and not in FullCalendar (ADR 0006 stays).
