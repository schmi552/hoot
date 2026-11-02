import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// MOCK=1 swaps the Tauri modules for a fake backend, to look at the app in a plain browser.
const mock = (globalThis as any).process.env.MOCK
  ? {
      "@tauri-apps/api/core": "/dev-mock/core.ts",
      "@tauri-apps/api/event": "/dev-mock/event.ts",
      "@tauri-apps/plugin-autostart": "/dev-mock/autostart.ts",
      "@tauri-apps/plugin-dialog": "/dev-mock/dialog.ts",
    }
  : {};

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  resolve: { alias: Object.fromEntries(Object.entries(mock).map(([k, v]) => [k, new URL(`.${v}`, import.meta.url).pathname])) },
});
