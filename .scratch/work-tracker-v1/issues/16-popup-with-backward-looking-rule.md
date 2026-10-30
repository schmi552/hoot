# 16: Popup with the backward-looking rule

**What to build:** At each interval a small popup asks what the user did. The answer becomes an Entry from the end of the previous Entry to now, with lunch and time outside work hours cut out.

**Blocked by:** 13 Entries in the week view

**Status:** resolved

- [x] Rust ticks every minute and emits a tick event with the time since the last tick.
- [x] The popup is its own small always-on-top window and follows the system light or dark setting. It uses the chat layout of prototype variant D.
- [x] No popup shows outside work hours or during lunch.
- [x] The new Entry runs from the end of the previous Entry (or the start of work hours) to now, minus lunch and time outside work hours. Popup Entries keep minute precision.
- [x] "Yes, still" extends the last Entry. Recent chips are the last three different Entries and fill description and Category in one tap.
- [x] The Category field holds the last Category and its list opens upward.
- [x] Enter sends. Ctrl+Enter (Cmd+Enter on macOS) answers "still doing that". Esc skips. A snooze button works.
- [x] The mascot says one short line for the step. A placeholder image is enough for v1.
- [x] Contrast passes WCAG AA, targets are at least 36 px, the thread is an `aria-live` log, every control has a focus ring, and animation stops with reduced motion.
- [x] TypeScript tests cover the popup span.
