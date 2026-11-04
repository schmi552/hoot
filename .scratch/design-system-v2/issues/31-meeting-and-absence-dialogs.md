# 31: Meeting form and Absence form as dialogs

**What to build:** The Meeting form and the Absence form were rows above the calendar. They got too wide. Show them as a modal dialog with one shared component. ADR 0023 records the decision.

**Blocked by:** none

**Status:** done

- [x] `FormDialog` (`src/FormDialog.tsx`) gives a header with the title, a body for labelled fields and a footer with Cancel and Save. Escape closes it. Both forms use it, and no code is copied.
- [x] A field has its label above it (`Field`). Related fields share a row (`.wt-dialog-row`).
- [x] A native `select` has the same height as other inputs (`select.wt-input` in `components.css`).
- [x] The Category list in the Meeting dialog opens downwards.
- [x] The Entry form stays a row above the calendar. ADR 0023 gives the reason.
