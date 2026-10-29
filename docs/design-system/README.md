# Work Tracker design system

This design system comes from prototype 06, variant D ("Hybrid: command bar, mascot, chips").
The prototype is throwaway. This folder is the durable copy of its visual decisions.

## Files

| File | Purpose |
|------|---------|
| `tokens.css` | All design tokens in three layers. Light and dark themes. |
| `components.css` | Popup components. They use component tokens only. |

## Token layers

1. **Primitive** (`--p-*`): raw values. They have no meaning. Do not use them in components.
2. **Semantic** (`--color-*`, `--space-*`, `--radius-*`, `--text-*`): purpose names. The dark theme changes only this layer.
3. **Component** (`--popup-*`, `--bubble-*`, `--chip-*`, `--input-*`, `--listbox-*`): hooks for one component each.

Rule: a component reads from its own layer. To restyle one component, change its component tokens.
To restyle the whole app, change the semantic tokens.

## Theme

- Default: follows the system (`prefers-color-scheme`).
- Force a theme: set `data-theme="light"` or `data-theme="dark"` on `<html>`.

## Foundations

**Color.** One accent (blue). One danger color. A warm header band (peach) gives the mascot a home.
Muted text is for hints only. I measured every text pair in both themes (text, muted text, text on accent, danger text, muted text on the header). All pairs are at least 5.5:1, which is above the 4.5:1 WCAG AA minimum.
In dark mode, the accent gets lighter and the text on it gets dark.

**Space.** A 4 px grid. Only three steps: 4, 8, 12 px.

**Radius.** Container 10. Bubble 14. Bubble tail 3. Controls are pills (99).
The small tail corner shows who speaks: bottom left is the mascot, bottom right is the user.

**Type.** System font. Body 14. Controls 13. Captions 12. Line height 1.4 for message text.

**Motion.** New bubbles slide up 6 px and fade in over 180 ms. Hover changes take 120 ms.
With `prefers-reduced-motion`, all motion stops.

**Elevation.** The popup has one large shadow. The category list has one upward shadow, because it opens above the input.

## Components

| Component | Class | Notes |
|-----------|-------|-------|
| Popup frame | `.wt-popup` | `role="dialog"`, `tabindex="0"`, focus the frame on open. |
| Header | `.wt-head` | Title on the left. Time and "Esc skip" on the right. |
| Thread | `.wt-thread` | `role="log"`, `aria-live="polite"`. Scrolls to the newest bubble. |
| Mascot bubble | `.wt-bot > .wt-bubble` | Pixel mascot (decorative, `aria-hidden`) and a bubble. |
| User bubble | `.wt-me` | Shows the answer the user gave. |
| Chip | `.wt-chip` | Quick reply. Use `aria-pressed` for a toggle. `.is-primary` for the main action. |
| Quick-reply row | `.wt-quick` | `role="group"`. Sits above the composer. |
| Composer | `.wt-composer` | Category field, description field, Send button, error line. |
| Input | `.wt-input` | Min height 36 px. |
| Category combobox | `.wt-combo` | List opens upward. The active option has a ring. |
| Startup screen | `.wt-startup` | Error and recovery screen. Buttons sit in `.wt-startup-actions`. |
| Error line | `.wt-error` | `role="alert"`. Reserve 16 px height so the layout does not jump. |

## Mascot

A 10 x 9 pixel grid. Colors: body, eye, mouth (semantic tokens `--color-mascot-*`).
Pixel size: 3 px in the popup, 5 px for onboarding or empty states.
Keep the mascot in the same colors in light and dark themes.

## Interaction rules

- The popup is keyboard first. Every chip shows its key in the label, for example "Home (H)".
- Esc skips the popup. Enter saves. Ctrl+Enter (Cmd+Enter on macOS) means "Yes, still".
- Focus ring: 2 px, offset 2 px. Inputs use offset 0 and change their border color.
- Touch and click targets are at least 36 px high.

## Not covered yet

The prototype has no design for these. Decide them before you build the screens:

- Calendar week view and month view (entries, meetings, absences).
- Gap warning box. Variant A used a hard-coded yellow (`#fff4d6`). Variant D has no equivalent. Add a `--color-warning` token when you need one.
- Success and info colors.
- Settings and onboarding screens.
- Data-viz palette for Categories in the calendar.

## Known gaps in the prototype

- The prototype hard-codes two radii (6 px for inputs and the list). This system keeps them as literals in `components.css`. Promote them to a token if a third use appears.
- The prototype ties the focus ring to `.d`. Here it applies to `.wt-popup`.
