# 29: Rename the app to Hoot, and use the mascot as the icon

**What to build:** The app is called Hoot. The app icon is the owl.

**Blocked by:** none

**Status:** done

**Done:**
- The icon: all sizes in `src-tauri/icons/` are made from the owl sprite (`tauri icon`). The menu bar icon needs a rebuild of the app to change.
- The name: window titles, product name, page title, toolbar and popup header, "Quit Hoot", autostart text, Restore text, the failed-save notification, `package.json`, the Rust crate (`hoot`, `hoot_lib`), and the export file names (`hoot_2026-10.xlsx`).
- The GitHub repo is `schmi552/hoot`. `origin` points to it.

**Kept on purpose:**
- The bundle identifier is still `app.worktracker`. A new identifier moves the data folder, and the database would look empty.
- The design board file name and old tickets, ADRs and notes keep "Work Tracker". They are a record.
- The local folder is still `tracker`. Rename it with `mv` when nothing is open.

- [x] The windows, the tray and the notification say "Hoot".
- [x] The icon shows the owl.
- [x] Typecheck, tests and `cargo check` pass.
- [x] The repo is renamed and `origin` works.
