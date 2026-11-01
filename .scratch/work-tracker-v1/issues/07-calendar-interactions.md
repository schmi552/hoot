# 07: Calendar interactions

**Type:** grilling
**Status:** resolved
**Blocked by:** 02

## Question

Which exact gestures and hotkeys does the calendar support for create, move, resize, copy, paste, duplicate and delete? How does the user add an Absence, a recurring Meeting, or edit one occurrence? What does the user see for the daily total against expected working time?

## Answer

Decided with the user in one grilling round. The user accepted all nine recommendations. No ADR: each choice is easy to change.

- **Create:** drag on an empty part of the week grid (15-minute snap), then an inline editor picks Category and description. `N` creates an Entry at the selected slot, or at the next free slot after the last Entry of the day. A click on a day in month view opens that day in week view.
- **Move and resize:** mouse drag to move, drag the bottom edge to resize. Keyboard: `↑`/`↓` move 15 minutes, `←`/`→` move one day, `Shift+↑`/`Shift+↓` resize the end by 15 minutes. We build the keyboard part (FullCalendar has none).
- **Copy, paste, duplicate:** `Cmd/Ctrl+C`, `Cmd/Ctrl+V` (selected slot, else next free slot), `Cmd/Ctrl+D` (next free slot right after the Entry). A copied Meeting pastes as a normal Entry with the same Category and description.
- **Delete and undo:** `Delete`/`Backspace` removes at once, with no dialog. `Cmd/Ctrl+Z` undoes and `Shift+Cmd/Ctrl+Z` redoes create, move, resize, paste and delete. History is lost on quit.
- **Overlap:** a resize stops at the edge of the next Entry. A move or paste that would overlap snaps back. A short message says why. Meetings never block.
- **Add Meeting or Absence:** a "+" toolbar menu (Entry, Meeting, Absence) with hotkeys `N`, `M`, `A`. The Meeting dialog has title, Category, start, duration and a repeat list: none, daily, weekdays, weekly, monthly. No custom RRULE editor in v1 (`.ics` import covers complex rules). The Absence dialog has label, all-day or part-day, and a date range. A drag on the all-day row creates a full-day Absence.
- **Edit one occurrence:** a dialog asks "This Meeting only" (writes a `meeting_exception`, override or skip) or "All Meetings" (changes the series). No "this and following" in v1.
- **Daily total:** each week-view day header shows "logged / expected", for example "6h 30m / 8h". Logged counts Entries only, not Meetings and not Absences. Expected is the work hours of that day, minus lunch, minus Absence hours. Warning colour when logged is below expected. Month view shows the same figure in each day cell.
- **Selection:** one Entry at a time (click or `Tab`). `Esc` clears it. `Enter` or double-click opens the inline editor. No multi-select in v1.
