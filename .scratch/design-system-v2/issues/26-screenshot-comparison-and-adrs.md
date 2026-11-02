# 26: Screenshot comparison and ADRs

**What to build:** A written procedure that checks "exactly". It lists every screen and state of the nine boards. For each one, take a screenshot of the app in light and dark, on macOS and Windows, and compare it with the board. Use the fixed board date: Thursday 29 October 2026, week 44. A difference is a bug, and the app changes (the board does not). Check the room around the 36 px mascot in the popup. Run the procedure, and record the result and the bugs.

Also write the decision records. Ask the user before you create the new ADR. The new ADR supersedes ADR 0004 (v2 base, boards as source of truth, the font and the token additions). ADR 0006 gets a note for the parts that we build ourselves. ADR 0005 gets a note that restore is also in Settings, if ticket 15 did not add it.

Spec story: 123.

**Blocked by:** 08 to 25

**Status:** ready-for-agent

- [ ] The procedure file lists every screen and state per board.
- [ ] Every item has a result for light and dark on macOS and Windows.
- [ ] Each difference is fixed or has its own ticket.
- [ ] The user approved the new ADR, and it is written.
- [ ] ADR 0005 and ADR 0006 have their notes.

## Comments

### Browser audit (Chrome, fake backend, `MOCK=1 npx vite --port 1421`)

Scope: only what Chrome can show (Week, Month, forms, Settings, Onboarding, Startup, Popup; light and dark; narrow widths by iframe). The native frame, macOS and Windows remain for the manual screenshots.

Fixed now:
- Dark mode: `html`/`body` had no background, an 8 px margin and no `color-scheme`. This gave white edges (Startup screen, Popup, scrims) and light native controls. Fixed in `components.css`.
- `.wt-input` was content-box: inputs were wider than their container. The Entry, Meeting and Absence forms stacked in many rows; the popup Category input was 6 px too wide. Fixed.
- Popup window had a stray shadow; long words overflowed bubbles. Fixed.
- Entry form time label used the browser locale ("Do."). Fixed to en-GB.

Not fixed (need a decision or their own ticket; the board is the source of truth):
- Week: Today column tint vs. blue number circle; day header layout (left date, icon in pill); non-work hours grey and Lunch band; Standup chips overlap Entries.
- Month: no category legend or hint; day numbers right-aligned; Today tint.
- Toolbar wraps in two rows at 1440 px (debug chips and gear). At 600 px day headers overlap.
- Meeting and Absence forms have no field labels.
- Settings: colour picker is an inline row, not a popover; Categories section layout; Recurring Meetings rows lack detail; Backups lacks intro line, banner and a styled Restore confirm; Work time notice has no icon.
- Popup: location chips are both primary; "Yes, still" is primary; gap flow is one composer, the board has a step with a bot question; focus ring is doubled; location text differs. Verify each against the board before changing.
- Onboarding step 3: Enter adds a row but focus stays in Name.
- Startup screen: card is top-pinned, buttons wrap.
