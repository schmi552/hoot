# 14: Move, resize, copy and undo

**What to build:** The user changes Entries with the mouse or the keyboard and can undo a mistake.

**Blocked by:** 13 Entries in the week view

**Status:** resolved

- [x] Mouse drag moves an Entry. A drag on the bottom edge resizes it.
- [x] `↑` and `↓` move 15 minutes. `←` and `→` move one day. `Shift+↑` and `Shift+↓` resize the end by 15 minutes. One Entry is selected at a time with a click or `Tab`. `Esc` clears the selection. `Enter` or double-click opens the editor.
- [x] `Cmd/Ctrl+C` and `Cmd/Ctrl+V` copy and paste. `Cmd/Ctrl+D` duplicates into the next free slot. `Delete` and `Backspace` remove at once.
- [x] `Cmd/Ctrl+Z` undoes and `Shift+Cmd/Ctrl+Z` redoes create, move, resize, paste and delete. History is lost on quit.
- [x] A resize stops at the next Entry. A move or paste that would overlap snaps back with a short message.
- [x] TypeScript tests cover the overlap rules for move, resize and paste.
