# 08: Sleep, wake and gap detection

**Type:** grilling
**Status:** open
**Blocked by:** None

## Question

How does the app find a missed popup tick after sleep, wake or a closed app? Choose between a wall-clock gap check in Rust, OS hooks (macOS `NSWorkspace`, Windows `WM_POWERBROADCAST`), or both. What counts as a gap, and what does the popup show for it? Use the findings of the Tauri capabilities ticket.
