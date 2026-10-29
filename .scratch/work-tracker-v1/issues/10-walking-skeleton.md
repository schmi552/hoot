# 10: Walking skeleton

**What to build:** A Tauri app that starts to a tray icon and hides its window when the user closes it. One Tauri command goes from React to Rust to SQLite and back. The `rusqlite_migration` set-up runs the first schema version at startup. Both test seams run: Rust command tests on a temporary SQLite file, and TypeScript schedule tests with plain inputs.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The app starts on macOS and Windows and shows a tray icon with Open and Quit.
- [x] Closing the main window hides it. The app keeps running.
- [x] A test command writes and reads one record through SQLite. React runs no SQL (ADR 0001).
- [x] `PRAGMA user_version` holds the schema version after the first migration.
- [x] One Rust command test and one TypeScript schedule test run in one test command.
