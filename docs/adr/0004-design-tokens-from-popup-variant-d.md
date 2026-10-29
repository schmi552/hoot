# Use popup variant D as the visual base, with three-layer CSS tokens

The visual language of the app comes from prototype 06, variant D (mascot chat thread, quick-reply chips, keyboard shortcuts). The tokens are plain CSS custom properties in three layers: primitive, semantic, component. Components read only component tokens. Only the semantic layer changes between light and dark themes. The files are in `docs/design-system/`. We did not choose Tailwind, because the project has no frontend framework yet. We did not keep the prototype as the source of truth, because it is throwaway code.
