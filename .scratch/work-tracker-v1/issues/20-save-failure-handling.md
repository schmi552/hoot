# 20: Save-failure handling

**What to build:** When a write fails, the user keeps what they typed and learns about the problem.

**Blocked by:** 14 Move, resize, copy and undo, 16 Popup with the backward-looking rule

**Status:** resolved

- [x] A failed write in the popup or editor keeps the answer and shows an error line with retry and copy.
- [x] If the popup is hidden, the app shows an OS notification: "Could not save. Open the app."
- [x] A failed write does not change the undo history.
- [x] Rust command tests force a write failure and check the error result.
