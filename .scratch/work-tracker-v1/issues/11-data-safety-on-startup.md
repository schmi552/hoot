# 11: Data safety on startup

**What to build:** The app protects the data of the user at startup and every day. It copies the database before a migration, handles a failed migration, checks the database, and makes a daily backup.

**Blocked by:** 10 Walking skeleton

**Status:** resolved

- [ ] The app copies the database to a `.bak` file before it migrates.
- [ ] Each migration runs in one transaction. A failed migration leaves the data as it was, the popup timer does not start, and an error screen shows the version numbers and error text with Copy details, Show backups folder and Quit.
- [ ] The app refuses a database with a newer version and shows a clear message.
- [ ] `PRAGMA quick_check` runs at startup. On failure the recovery screen offers Restore latest backup and Start empty. Each renames the bad file to `tracker-corrupt-<date>.db`. Restore tells the user how many days may be missing. With no backup only Start empty and Quit show.
- [ ] On the first start of each day the app makes a copy with `VACUUM INTO` in `backups/` and keeps the last 7. It never deletes the pre-migration copy.
- [ ] Rust command tests cover each case above.
