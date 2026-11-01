# 20: Week view details

**What to build:** The rest of the week board. A Category share summary and the weekly total with Expected show in a sidebar at the right on windows 1000 px wide or more, and under the grid on narrower windows. Each day header shows the day, the **Workday location** badge and the daily total. A click on the badge opens a menu with Home and Office, on any visible Workday, also in the future. There is no clear option, and a non-workday has no badge. A drag or resize shows a preview with a dashed accent outline, and a red "Overlaps" text when the drop would overlap. The dragged source is at 40 % opacity. A short-day notice shows when the week view opens, if a past Workday has less time than expected. Its range is the first unlogged gap in work hours, and it is for the latest short past Workday of the current week. Today and future days never warn. The user can dismiss the notice, and it stays dismissed for that day until the user logs more. An empty week shows an empty state in the middle that says when the next check-in comes (a new Tauri command gives the time). The empty state does not block clicks.

Spec stories: 82, 84 to 92.

**Blocked by:** 19

**Status:** done

- [ ] Vitest tests cover the short-day notice: past only, first unlogged gap, dismissed state, and no warning for today or the future.
- [ ] The layout changes at 1000 px.
- [ ] The location menu sets Home or Office on any visible Workday.
- [ ] "Overlaps" shows during a drag or resize that would overlap, and the drop is refused.
- [ ] The empty state shows the next check-in time and lets clicks pass.
- [ ] The view matches the week board in light and dark.
