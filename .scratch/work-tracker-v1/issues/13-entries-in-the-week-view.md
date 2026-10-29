# 13: Entries in the week view

**What to build:** The user sees a week view and creates Entries in it. Each day header shows the logged time against the expected time.

**Blocked by:** 12 Onboarding and settings

**Status:** resolved

- [x] The `entry` table exists. The Store command rejects an Entry that overlaps another Entry.
- [x] FullCalendar v7 shows the week view with 15-minute snap.
- [x] A drag on an empty part of the grid opens an inline editor for Category and description, then saves an Entry.
- [x] `N` creates an Entry at the selected slot, or at the next free slot after the last Entry of the day.
- [x] Each day header shows "logged / expected", for example "6h 30m / 8h". Expected is work hours minus lunch. The header uses a warning colour when logged is below expected.
- [x] A check confirms the `eventAllow` and `eventOverlap` behaviour in the macOS and Windows web views.
- [x] Rust command tests cover create and the overlap check. TypeScript tests cover the daily total.
