# Research 03: Tauri v2 capabilities

Ticket: `.scratch/work-tracker-v1/issues/03-tauri-capabilities.md`
Date: 2026-10-28

## Recommendation

1. **Tray, autostart, popup window, in-app hotkeys:** All four work on Tauri v2 for macOS and Windows with first-party features and plugins. Use the `tray-icon` feature, `tauri-plugin-autostart`, a second window with `alwaysOnTop`, and normal DOM key events for in-app hotkeys. Do not use the global-shortcut plugin for in-app hotkeys.
2. **SQLite:** Both routes are sound. The Tauri SQL plugin has built-in versioned migrations that run in a transaction. `rusqlite` with `rusqlite_migration` keeps all data access in Rust. Lean: `rusqlite`, because the Excel export and the gap logic also live in Rust. This decision is hard to reverse, so ask the user about an ADR.
3. **Excel:** Use `rust_xlsxwriter` in a Rust command. It writes several worksheets, dates, autofit and tables. It is write-only, which is enough for export.
4. **Sleep and wake:** Tauri has **no** official sleep or wake event. Use a wall-clock gap check in Rust as the base (works on both systems, no native code). Add OS hooks (macOS `NSWorkspace` notifications, Windows `WM_POWERBROADCAST`) only if the gap check is not enough.
5. **Open point:** The SQLite route needs one user decision. See "SQLite route".

## Findings

### Tray app

- Enable the Cargo feature `tauri = { version = "2.0.0", features = ["tray-icon"] }`. [Tauri: System Tray](https://v2.tauri.app/learn/system-tray/)
- Create the icon in Rust with `TrayIconBuilder::new().build(app)?` in `setup`, or in JS with `TrayIcon.new(options)`. Same source.
- The menu opens on left and right click by default. Call `show_menu_on_left_click(false)` (JS: `menuOnLeftClick: false`) to change this. Same source.
- Tray events are Click, DoubleClick, Enter, Move and Leave. Use `.on_tray_icon_event(...)`. Same source.
- `RunEvent::TrayIconEvent` exists for desktop with `tray-icon`. [docs.rs: RunEvent](https://docs.rs/tauri/latest/tauri/enum.RunEvent.html)
- On macOS, `set_activation_policy(ActivationPolicy::Accessory)` and `set_dock_visibility(false)` exist. The default policy is `Regular`. [tauri source: app.rs](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri/src/app.rs) Use them to hide the Dock icon for a tray-only app.
- Not verified: how to keep the app alive when the last window closes. `RunEvent::ExitRequested { code, api }` exists per the docs.rs page above. Read the `api` methods before design.

### Autostart at login

- Plugin: `tauri-plugin-autostart`. It supports Windows, Linux and macOS and needs Rust 1.90 or later. [Plugin README](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/autostart), [Tauri: Autostart](https://v2.tauri.app/plugin/autostart/)
- Initialize inside `#[cfg(desktop)]` with `MacosLauncher::LaunchAgent` and optional launch arguments. Same sources.
- API: JS `enable()`, `isEnabled()`, `disable()`. Rust `app.autolaunch()` with `enable()`, `is_enabled()`, `disable()`. Same sources.
- Permissions: `autostart:allow-enable`, `autostart:allow-disable`, `autostart:allow-is-enabled`. Same sources.
- macOS has two strategies. `LaunchAgent` (default) installs a plist under `~/Library/LaunchAgents`. `AppleScript` adds a login item through "System Events". [plugin source lib.rs](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/autostart/src/lib.rs)
- The Tauri docs do not describe the Windows mechanism. The plugin uses the `auto_launch` crate (named in `lib.rs`). Read that crate before you claim a mechanism.
- Launch arguments (for example `--hidden`) are forwarded to the app. The docs do not say how the app reads them. Use this to start in the tray with no window.

### Separate always-on-top popup window

- Window config fields exist: `always_on_top`, `skip_taskbar`, `visible`, `decorations`, `focus`, `visible_on_all_workspaces`. [tauri-utils config.rs](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-utils/src/config.rs)
- `skip_taskbar` "hides the window icon from the taskbar on Windows and Linux". It does nothing on macOS.
- `visible_on_all_workspaces` is unsupported on Windows, iOS and Android. Same source.
- `setAlwaysOnTop` at runtime needs `core:window:allow-set-always-on-top`. It is not in `core:window:default`. [Tauri: window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/)
- Capabilities attach to windows by label, in `src-tauri/capabilities`. Give the popup its own label and capability file. [Tauri: Capabilities](https://v2.tauri.app/security/capabilities/)
- Design note: make the popup a second window, hidden at start, and show it on each tick. The `WebviewWindowBuilder` docs were not read.

### In-app hotkeys

- The global-shortcut plugin registers **system-wide** shortcuts. Nothing is enabled by default. It needs `global-shortcut:allow-register` and related permissions. [Tauri: Global Shortcut](https://v2.tauri.app/plugin/global-shortcut/)
- The docs do not discuss in-app-only keys. Use `keydown` handlers in the React app for copy, paste, duplicate and delete. They work only while the window has focus, which is what the ticket needs.
- Use the global-shortcut plugin only if the user wants a key that opens the popup from any app. The outline does not ask for this.
- Not verified: how the WebView handles Cmd/Ctrl+C and Cmd/Ctrl+V on each OS. Test in the first prototype.

### SQLite route

**Tauri SQL plugin** ([docs](https://v2.tauri.app/plugin/sql/))
- Built on `sqlx`. The engine is chosen by Cargo feature (`sqlite`). Needs Rust 1.90 or later.
- A Rust `Migration` has `version`, `description`, `sql`, `kind`. SQL can come from `include_str!`. Register with `add_migrations("sqlite:file.db", migrations)`. They run on `load()` or through `plugins.sql.preload` in `tauri.conf.json`.
- Each migration runs in a transaction. If one fails, the whole transaction rolls back.
- The docs mention Up and Down kinds but show only Up.
- Permissions: `sql:default` gives close, load and select. Writes need `sql:allow-execute`.
- SQLite paths are relative to the app config directory.
- SQL runs from JS (`db.execute`, `db.select`), so there is no Rust type layer unless you add one.

**`rusqlite` with `rusqlite_migration`**
- `rusqlite` 0.41.1 (MIT) has an online backup API behind the `backup` feature. [docs.rs: rusqlite](https://docs.rs/rusqlite/latest/rusqlite/)
- `rusqlite_migration` 2.6.0 stores the version in SQLite `user_version`. Migrations are SQL strings in `M::up(...)`, applied with `to_latest(&mut conn)`. Its examples include down migrations. It warns that other code that changes `user_version` gives unspecified behavior. [docs.rs: rusqlite_migration](https://docs.rs/rusqlite_migration/latest/rusqlite_migration/)
- Not verified: how to share a `Connection` across Tauri commands. The rusqlite page did not cover thread safety. Plan a `Mutex` or a pool.

| Topic | SQL plugin | `rusqlite` |
|---|---|---|
| Migrations | Built in, transactional | Extra crate, `user_version` |
| Where SQL runs | Frontend (JS) | Rust commands |
| Fit with Rust xlsx export | Export needs a separate DB access in Rust | Same connection in Rust |
| Backup (map: "data safety") | Not covered in the docs read | `backup` feature available |
| Permissions | Capability entries needed | None for DB (own commands) |

### Excel export

- `rust_xlsxwriter` 0.101.0, MIT OR Apache-2.0. It writes text, numbers, dates, formulas, formatting, tables and autofit. A workbook can hold many worksheets. It is write-only. [docs.rs: rust_xlsxwriter](https://docs.rs/rust_xlsxwriter/latest/rust_xlsxwriter/)
- Dates use `ExcelDateTime`, with `chrono` and `jiff` features. Optional `constant_memory` and `enhanced_autofit` features exist. Same source.
- The two-sheet format from ticket 01 fits this crate directly.
- Save flow: JS calls `save` from `@tauri-apps/plugin-dialog` for a path (`dialog:allow-save`). [Tauri: Dialog](https://v2.tauri.app/plugin/dialog/) A Rust command then writes the file, so the fs plugin is not needed. The fs plugin docs were not read.
- No JS Excel library was compared from primary sources. The Rust route avoids sending all rows through the WebView and adds no JS dependency. This is a reasoned choice, not a measured one.

### Sleep and wake

- Tauri has no power event. `WindowEvent::Suspended` and `Resumed` are mobile only. `RunEvent::Resumed` means "event loop is being resumed". [tauri source: app.rs](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri/src/app.rs), [docs.rs: RunEvent](https://docs.rs/tauri/latest/tauri/enum.RunEvent.html)
- A request for a power monitor was closed as "not planned", in favor of #8968. [tauri#7466](https://github.com/tauri-apps/tauri/issues/7466)
- A macOS report says the `resumed` run event never fires after sleep. [tauri#10662](https://github.com/tauri-apps/tauri/issues/10662) The issue was closed on 2026-04-14 by PR #14523, which handles WebView content-process termination. One user there reloaded the WebView on the macOS wake notification.
- Windows: `WM_POWERBROADCAST` sends `PBT_APMSUSPEND` on suspend. It always sends `PBT_APMRESUMEAUTOMATIC` on resume, and also `PBT_APMRESUMESUSPEND` if user input caused the resume. It does not say which low-power state. [Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/power/wm-powerbroadcast)
- macOS: `NSWorkspace.willSleepNotification` and `NSWorkspace.didWakeNotification`, posted to `NSWorkspace.shared.notificationCenter`. The Apple page did not load, so this is from general knowledge. Check [Apple docs](https://developer.apple.com/documentation/appkit/nsworkspace/didwakenotification).
- Community plugin `tauri-plugin-idlemonitor` v0.2.4 (MIT) has `onSuspend` and `onResume`. It has 1 star, and its README is inconsistent on Windows suspend/resume ("supported" and "Planned"). [repo](https://github.com/mindflowgo/tauri-idlemonitor) Use it as a reference, not a dependency.
- Fallback with no native code: run a Rust timer. On each tick, compare wall-clock time to the last tick. A gap much longer than the interval means sleep or a missed tick. This feeds the "gap popup" in the map. No primary source covers this method. Test it on both systems.

## macOS versus Windows differences

| Topic | macOS | Windows |
|---|---|---|
| Tray | Works. Hide the Dock icon with `set_activation_policy(Accessory)` or `set_dock_visibility(false)`. | Works. No Dock. |
| Autostart | `LaunchAgent` plist in `~/Library/LaunchAgents` (default), or AppleScript login item. | Done by the `auto_launch` crate. Tauri docs do not state the mechanism. |
| Taskbar | `skip_taskbar` has no effect. | `skip_taskbar` hides the popup from the taskbar. |
| Always on top | `alwaysOnTop` available. `visible_on_all_workspaces` works. | `alwaysOnTop` available. `visible_on_all_workspaces` unsupported. |
| Sleep/wake signal | `NSWorkspace` will-sleep and did-wake notifications. | `WM_POWERBROADCAST` suspend and resume messages. |
| Known wake bug | WebView process can die after sleep (tauri#10662, closed by PR #14523 in 2026). Verify the fixed Tauri version. | UI state loss after wake reported in tauri#8304 (title seen in search only, not read). |
| Tray events | Supported. | Supported. Only Linux is documented as unsupported. |

## Open questions

- Which SQLite route? It needs a user decision and probably an ADR.
- Must the popup show above full-screen apps on macOS? The sources read do not cover this.
- Read the `WebviewWindowBuilder` docs and the `ExitRequested` `api` docs when design starts.
