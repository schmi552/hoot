# 03: Tauri capabilities

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

On Tauri v2, for macOS and Windows: how do we build the tray app, autostart at login, a separate always-on-top popup window, and in-app hotkeys? Which is the better SQLite route (the Tauri SQL plugin or `rusqlite`) given schema migrations? Which library writes the two-sheet Excel file best (`rust_xlsxwriter` or a JS library)? Can the app detect sleep and wake? Note any difference between the two operating systems.

## Answer

Findings are on the branch `research/tauri-capabilities` (`.scratch/work-tracker-v1/research/03-tauri-capabilities.md`). The branch is never merged.

- Tray, autostart, a separate always-on-top popup window and in-app hotkeys all work on Tauri v2 for macOS and Windows.
- SQLite has two sound routes: the Tauri SQL plugin, or `rusqlite` with `rusqlite_migration`. The researcher leans to `rusqlite`. This is open for the Data model ticket.
- Use `rust_xlsxwriter` for the Excel export.
- Tauri has no official sleep or wake event. Use a wall-clock gap check in Rust, plus OS hooks if needed. Test on both systems.
- `skip_taskbar` has no effect on macOS. `visible_on_all_workspaces` is unsupported on Windows. The Dock icon needs `set_activation_policy(Accessory)`.
