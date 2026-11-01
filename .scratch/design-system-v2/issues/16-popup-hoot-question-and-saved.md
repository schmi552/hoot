# 16: Popup with Hoot: question and saved

**What to build:** The popup looks like the popup board. Hoot, the owl mascot, asks in a chat bubble. Hoot is drawn as a pixel grid (the build picks SVG, canvas or CSS) in four moods: Asking, Away, Saved and Problem. Pixel size is 3 px in the popup. Asking shows for every question, Saved after a save and Problem after a failed save. Away is used by ticket 17. When "Show the mascot" is off, the sprite is hidden and the bubble keeps its place. The Category list opens upward, with a color dot and "code name" in each option. The header says "Esc skip" and then "Esc close" after a save. Ctrl+Enter (Cmd+Enter on macOS) answers "Yes, still". The saved state shows the time range and the Category code, and closes after 1.5 seconds. A failed save shows the error with "Retry" and "Copy", and Hoot returns to Asking on retry. The Snooze chip, its code and its constant are removed. The popup window stays 400 x 520. Check that the 36 px mascot fits. If it does not, change the layout and not the window size.

Spec stories: 33 to 42, 46, 47.

**Blocked by:** 08, 09, 12

**Status:** ready-for-agent

- [x] The popup matches the popup board for Asking, Saved and Problem in light and dark.
- [x] The mascot fits in the 400 x 520 window.
- [x] No Snooze code or constant remains.
- [x] Esc skips, and the next tick asks again. Esc closes after a save.
- [x] The key rule for "Yes, still" works on macOS and Windows.
- [x] Retry after a failed save sets the mood to Asking.
