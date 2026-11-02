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
