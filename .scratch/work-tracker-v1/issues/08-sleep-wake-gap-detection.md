# 08: Sleep, wake and gap detection

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

How does the app find a missed popup tick after sleep, wake or a closed app? Choose between a wall-clock gap check in Rust, OS hooks (macOS `NSWorkspace`, Windows `WM_POWERBROADCAST`), or both. What counts as a gap, and what does the popup show for it? Use the findings of the Tauri capabilities ticket.

## Answer

- **Detection:** a wall-clock check in Rust. The timer ticks every minute. If the time since the last tick is much longer than one minute, the app sees a sleep, a wake, or a closed app. v1 has no OS hooks (`NSWorkspace`, `WM_POWERBROADCAST`). Add them later only if tests on real machines show a problem.
- **Gap:** the span an Entry would cover under the backward-looking rule. It starts at the later of the last Entry end or the last answered or skipped popup. Lunch, time outside work hours, Meetings and Absences are cut out. If the rest is shorter than the popup interval plus a small margin, there is no gap.
- **Timing:** after a wake, the gap popup shows at once inside work hours. Outside work hours, it waits for the next start of work hours. It replaces the normal tick. It never adds a second popup.
- **Several days:** only the current workday can produce a gap popup. Earlier days stay empty. The user adds Entries there in the calendar.
- **Gap popup:** accept (one Entry), split (two or more Entries), or leave empty. The previous Entry shows as a chip. The app saves nothing until the user answers.
