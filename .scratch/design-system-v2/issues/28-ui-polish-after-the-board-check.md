# 28: UI polish after the board check

**What to build:** Fix the differences that the browser check of ticket 26 found, then improve the calendar and Settings screens from the user's review. The work ran in one session. This ticket records it.

**Blocked by:** 26 (the browser audit)

**Status:** done

**Done:**
- A fake backend for browser checks: `dev-mock/`, started with `MOCK=1 npx vite --port 1421`. The clock stands on Thursday 29 October 2026.
- Dark mode: the window base now sets `color-scheme`, a background and no margin, so there is no white edge. `.wt-input` is `border-box`.
- Popup, Settings, Onboarding, Startup screen and Calendar: the differences from the boards that the audits found. Two stay on purpose: the Workdays picker (ADR 0007) and the interval chips.
- Calendar toolbar: Week and Month are one joined toggle. "+ New" is a primary chip. Export, Settings and Quit are in a "…" menu with plain rows. The title opens a date field. The week navigation above the grid was tried and reverted. ADR 0022 records this.
- Week and Month scroll inside the window. The day headers stay. The empty alert line takes no room. An empty week shows a blur behind its message, and shows it at once.
- Speed: date formatters are built once, FullCalendar options are stable, and the calendar loads a window of data. See ticket 27.
- Dragging or resizing an Entry keeps the new time on the grid while it saves. A drag preview no longer crashes the screen.
- Settings: the header matches the calendar. Only the settings content scrolls. The menu highlights the clicked item and follows the scroll. A new Category can pick a color, and it has a "Save" button with the Enter icon. A click outside the picker closes it.
- The notification plugin permission, so the console shows no error.

**Left (by choice):**
- The toolbar and the Month and Week changes differ from the boards. ADR 0022 records them.
- The macOS and Windows screenshots stay in ticket 26.

- [x] The differences from the audits are fixed, or listed above as kept.
- [x] The browser checks passed in light mode. Most were also done in dark mode.
- [x] Typecheck and the 114 tests pass.
- [x] ADR 0022 records the toolbar decision.
