# 12: Onboarding and settings

**What to build:** On first run the user enters work hours, lunch, the popup interval and Categories. The user can change these at any time. A change applies from today on. The full screen-by-screen flow is not yet specified, so build a plain form.

**Blocked by:** 10 Walking skeleton

**Status:** resolved

- [x] The `category`, `settings_history` and `app_setting` tables exist.
- [x] The first-run form saves work hours, lunch, interval and Categories.
- [x] A settings change writes a new `settings_history` row with an effective-from date of today. A past day still uses the hours that were true on that day.
- [x] The user can add a Category. A Category with Entries is archived and not deleted.
- [x] Settings has a Show backups folder button.
- [x] Rust command tests cover the settings history lookup for a past day.
