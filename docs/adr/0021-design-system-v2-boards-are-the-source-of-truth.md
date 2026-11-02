# Use the v2 design system, and let the boards decide

Supersedes ADR 0004.

The visual base is the v2 design system in `docs/design-system/`. The nine boards in `Work Tracker Design System.html` are the source of truth. If the app and a board differ, that is a bug, and the app changes. If the CSS and the board differ, the CSS changes. The old popup variant D is no longer the base.

The tokens stay plain CSS custom properties in three layers (primitive, semantic, component). Components read only semantic and component tokens. Only the semantic layer changes between light and dark. v2 adds tokens: the text sizes 11, 15 and 16 px, the 4 px radius, and component tokens for one-off widths such as `--menu-width` and `--month-week-width`. A literal that a board uses more than once becomes a token.

The display font is Pixelify Sans. It is a variable font (400 to 700) and the app packages it locally, so the app works offline. It is used only for the app name, the first mascot line of a screen, empty states and the step numbers of Onboarding.

The window base sets `color-scheme`, a background and no margin, so a dark theme on a light system shows no white edge.

We did not keep variant D as the base, because the boards now show more screens than the prototype did. We did not choose Tailwind, for the same reason as in ADR 0004.
