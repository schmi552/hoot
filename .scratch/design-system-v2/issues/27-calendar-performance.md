# 27: Calendar performance

**What to build:** Make the calendar switch faster in the real app. Ticket 26 found the main cause: the date helpers made a new `Intl.DateTimeFormat` on every call (hundreds per render). Formatters are now cached, FullCalendar options are stable, and the calendar loads a window of data. This ticket is for the rest.

Measured in the Tauri window (`npm run tauri dev`, macOS, WebKit), in ms, including two animation frames (about 33 ms):

| Switch | Before | After |
|---|---|---|
| Next week | 163 | 49 |
| Week to Month | 342 | 74 |
| Next month | 303 | 56 |
| Month to Week | 874 | 86 |

The database is not the cause: 13 weeks of Entries take 0.32 ms on two years of data.

**Left to do:**
- A Month switch does three renders. One comes from the layout effect that sets the offset of the Week column. Find a way that needs no extra render.
- Some formatters are still made on every render (about 55 on one menu click). They come from `toLocale*String` calls in `Calendar.tsx`, `SettingsData.tsx`, `Popup.tsx` and from inside FullCalendar. Reuse them with `formatter()` where the code is ours.
- A click on "+ New" takes about 30 ms, because the whole calendar renders. Check what else can stay the same between renders (the callbacks, `dayHeaderContent`, `eventContent`).
- Measure a release build. `tauri dev` uses the slow development mode of React, and a release app has no inspector. Find a way to time it.
- Add a timing check to `docs/manual-checks.md` (the console snippet from ticket 26) with a limit for each switch.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] A switch between Week and Month takes less than 60 ms in the Tauri window, with the two frames of the snippet included.
- [ ] A Month switch does one render, or the extra renders are explained.
- [ ] No `new Intl.DateTimeFormat` or `toLocale*String` call runs per cell or per event in a render path.
- [ ] `docs/manual-checks.md` has the timing check.
