# 14: Settings screen: Work time and Appearance

**What to build:** A Settings screen with the shell of the settings board and the sections Work time and Appearance and startup. It has a "Back to calendar" action that leaves with no warning and drops unsaved Work time edits. Only Work time has "Discard" and "Save changes". "Discard" resets Work time to the saved values. Work time uses the shared fields from ticket 13, with these differences from Onboarding: the lunch is one box ("12:00 · 30 min") that takes any length, and a saved interval such as 20 shows the nearest chip (15) and changes only when the user saves. A blue notice says "Expected per day changes from 8h 30m to 8h 00m" and shows a From date. It defaults to the next Monday and cannot be in the past. The date field is hidden when Expected per day does not change. Settings also has a Workday picker (ADR 0012), which is the one deliberate gap from the board. Appearance and startup has the theme, "Show the mascot", "Open Work Tracker when I log in" (acts at once, no Save) and "First check-in today at HH:MM" (computed from work start and interval, not stored).

Spec stories: 58 to 64, 70, 71.

**Blocked by:** 08, 11, 12

**Status:** done

- [x] Vitest tests cover the nearest interval chip and the first check-in time.
- [x] Back to calendar leaves with no warning and drops edits.
- [x] Discard resets the Work time fields. Save changes sends the start date to `save_settings`.
- [x] The start date field shows only when Expected per day changes.
- [x] The login setting acts at once.
- [x] The section matches the settings board in light and dark, except for the Workday picker.
