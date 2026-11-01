# 06: Popup and mascot prototype

**Type:** prototype
**Status:** resolved
**Blocked by:** None

## Question

What should the popup look like and how should it feel? Prototype several variants of the text field, Category dropdown, "still doing that?" button, gap choice, home/office question, and mascot placement. Pick the variant that is fastest to use.

## Answer

Variant **D, chat thread**, won. It is variant A (keyboard first) with a mascot and recent chips, shown as a chat.

- **Layout:** the popup is a small chat. The mascot asks in bubbles on the left. The answers of the user appear as bubbles on the right. Quick replies are round chips above the composer. The composer has a Category field and a text field with a Send button.
- **Steps:** the steps run in this order, and a step is skipped when it does not apply.
  1. Workday location: only in the first popup of the day. Home or Office.
  2. Gap: only after a missed tick. Same as before, Split it (the user gives a time), or Leave empty.
  3. Work: "Still on X?" with a "Yes, still" chip, or the user types a description. Recent chips fill description and Category in one tap.
- **Keys:** H and O pick the location. A, S and L pick the gap choice. Enter sends. Ctrl+Enter (Cmd+Enter on macOS) answers "still doing that". Esc skips. The Category field is filled with the last Category and its list opens upward.
- **Mascot:** a bubble speaks only one short line for the current step. There is no long chat flow.
- **Theme:** the popup follows the system light or dark setting. The theme switch in the prototype is for testing only.
- **Accessibility:** contrast passes WCAG AA, every control has a visible focus ring, targets are at least 36px, the thread is an `aria-live` log, and animation stops when the system asks for reduced motion.
- **Dropped:** variant B (big buttons wizard) was too slow. Variant C (full mascot chat with chip rows) needed a mouse and too much height. Variant A has no mascot.

Prototype: `.scratch/work-tracker-v1/prototypes/06-popup/index.html` (open `?variant=D`).

Open points for the spec: how the app picks the recent chips (for example the last three different Entries), and the exact meaning of the Split time.
