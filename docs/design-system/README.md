# Work Tracker design system, v2

`Work Tracker Design System.html` is the visual reference. It holds nine boards. **If the `.html` and the CSS differ, the `.html` wins. Change the CSS.**

## Files

| File | Purpose |
|------|---------|
| `Work Tracker Design System.html` | The reference. Open it in a browser. |
| `tokens.css` | All tokens in three layers. It is the same block as in the boards. Light, dark and forced themes. |
| `components.css` | The `wt-*` classes. Written from the inline styles of the boards. Also loads the pixel font. |
| `../../src/assets/fonts/PixelifySans.woff2` | Pixelify Sans (OFL), local. No network request. |

## Token layers

1. **Primitive** (`--p-*`): raw values. Do not use them in components.
2. **Semantic** (`--color-*`, `--space-*`, `--radius-*`, `--text-*`, `--cat-N-*`): purpose names. The dark theme changes only this layer.
3. **Component** (`--popup-*`, `--chip-*`, `--input-*`, `--calendar-*`, `--entry-*` ...): hooks for one component. They are declared on `:root` and on `[data-theme]`, so a forced theme on one element recomputes them.

A component reads only semantic and component tokens. A literal that the boards use more than once is a token (text 11, 15, 16 px; radius 4 px). A one-off width is a component token (`--menu-width`, `--month-week-width` ...).

## Theme

- Default: follows the system (`prefers-color-scheme`).
- Force a theme: set `data-theme="light"` or `"dark"` on `<html>` or on any element.

## Rules

- Pixel face (`--font-display`) only for the app name, the first mascot line of a screen and empty states.
- Disabled controls: 45 % opacity, `not-allowed` cursor, no hover change.
- Focus ring: 2 px, offset 2 px. Inputs: offset 0 and a focus-colored border.
- `prefers-reduced-motion`: all motion off.
