# 32: Only one form open, and one "New Event" dialog

**What to build:** Make it impossible to open the Entry form, the Meeting form and the Absence form at the same time. Join the two dialogs for a new Meeting and a new Absence into one "New Event" dialog. Give the "+ New" menu the look of the "…" menu.

**Blocked by:** 31

**Status:** done

- [x] Opening one of the three forms closes the other two.
- [x] The "+ New" menu has "Entry (N)", "Meeting / Absence (M)" and "Import .ics … (I)". The rows are plain list rows (`.wt-menuitem`), not chips.
- [x] The dialog for a new Meeting or Absence is titled "New Event" and has a Meeting | Absence switch in the header. The `M` and `A` keys open it on the matching kind.
- [x] Editing an existing Meeting or Absence shows no switch. The Meeting dialog in Settings shows no switch either.
- [x] ADR 0023 records the decision and the rejected options (one dialog for all three kinds, and Absence as a Category).
