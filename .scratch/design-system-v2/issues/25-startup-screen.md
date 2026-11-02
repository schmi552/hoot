# 25: Startup screen

**What to build:** The startup screen keeps its three cases (error, migration, tooNew). The text is in the voice of the boards, and the title uses the pixel font. A button "Restore backup of 28 Oct" names the date of the newest backup. "Copy details" and "Show backups folder" are secondary chips.

Spec stories: 120 to 122.

**Blocked by:** 08

**Status:** done

- [x] Each of the three cases shows its own text.
- [x] The restore button shows the real date of the newest backup. It is disabled when there is no backup.
- [x] "Copy details" copies the error. "Show backups folder" opens the folder.
- [x] The screen matches the board in light and dark.
