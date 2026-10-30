# 21: Autostart and platform polish

**What to build:** The app starts at login and behaves well on both systems.

**Blocked by:** 12 Onboarding and settings

**Status:** ready-for-agent

- [x] Autostart at login works on macOS and Windows. A settings switch turns it on or off.
- [x] On macOS the app has no Dock icon (`set_activation_policy(Accessory)`).
- [ ] The popup stays on top on both systems. (`alwaysOnTop` is set. Hand check still open: see `docs/manual-checks.md`.)
- [x] A short manual check list for tray, autostart and popup is added to the repo docs.
