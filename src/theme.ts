import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Theme = "system" | "light" | "dark";
export type Appearance = { theme: Theme; showMascot: boolean; playSound: boolean };

/** "system" removes the attribute, so the tokens follow the system setting. */
export const applyTheme = (theme: Theme) =>
  theme === "system" ? document.documentElement.removeAttribute("data-theme") : document.documentElement.setAttribute("data-theme", theme);

/** Applies the stored theme now, and again on every change from any window. Call once per window. */
export function followTheme() {
  invoke<Appearance>("get_appearance").then((a) => applyTheme(a.theme), () => {});
  listen<Theme>("theme-changed", ({ payload }) => applyTheme(payload));
}
