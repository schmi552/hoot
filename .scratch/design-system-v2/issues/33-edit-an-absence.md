# 33: Edit an Absence

**What to build:** An Absence could only be created and deleted. Add an edit.

**Blocked by:** 31

**Status:** done

- [x] Rust has `update_absence` (`store.rs`, `lib.rs`). A test changes a full-day Absence into a part-day Absence and checks that the table refuses an invalid row.
- [x] A selected Absence opens in the dialog with Enter, with a double-click, or with the "Edit Absence" button in the side panel. The title is "Edit Absence".
- [x] A part-day Absence keeps its own zone when it is edited.
