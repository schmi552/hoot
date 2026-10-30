# 08: Tokens, components shell and offline font

**What to build:** The app uses the v2 design system files, and the build passes again. `tokens.css` v2 is the token block that is the same in all nine boards. It has three layers: primitive, semantic, component. The dark theme works for the system setting and for a forced `data-theme="dark"`. Component tokens are declared on `:root` and on `[data-theme]`. `components.css` is written from the inline styles of the boards, with one place for each `wt-*` class. Literal values that the boards use more than once (text 11, 15 and 16 px, radius 4 px) become tokens. One-off widths become component custom properties. Pixelify Sans is packaged as a woff2 file and loads with `@font-face`, so the app works offline. A README says the `.html` board file is the visual reference and wins over the CSS. Every disabled control has the disabled style.

Spec stories: 1 to 8, 12.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `src/main.tsx` imports files that exist, and the build passes.
- [x] Components read only semantic and component tokens. No primitive or raw value is in a component.
- [x] The light, dark and forced themes show the values of the boards.
- [x] The pixel font loads from a local woff2 file with no network request.
- [x] Disabled controls have 45 % opacity, a `not-allowed` cursor and no hover change.
- [x] The README states that the `.html` wins over the CSS.
