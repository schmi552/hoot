# 22: Toolbar, keys and "+" menu

**What to build:** The toolbar matches the board: the mascot, Previous, Today (T), Next, the title ("Week 44 · 26 – 30 Oct 2026", ISO week), Week (W), Month (M), Export and "+". A gear button after "+" opens Settings, and so does Ctrl+, (Cmd+, on macOS). T, W and M always work. N (Entry), A (Absence) and I (Import) work at any time. M means "New Meeting" only while the "+" menu is open. "Import .ics …" is in the "+" menu. The Debug button shows in dev builds only.

Spec stories: 100 to 104.

**Blocked by:** 14, 19

**Status:** done

- [x] Vitest tests cover the key rules, including M with and without the open menu.
- [x] The title shows the ISO week number and the date range.
- [x] The gear button and the shortcut open Settings on macOS and Windows.
- [x] The Debug button is absent in a production build.
- [x] The toolbar matches the board in light and dark.
