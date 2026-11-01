# 18: FullCalendar spikes

**What to build:** Five short checks that research could not verify. Do them before the calendar tickets. Write the result of each check in the "Result" section at the bottom of this file. If a check fails, write the fallback that the calendar tickets must use.

1. The mirror event has the new start and end during drag and resize (needed for the "Overlaps" text).
2. The source event can show at 40 % opacity with a visible child.
3. `slotMinHeight: 32` gives exactly 64 px per hour with the real label font.
4. A portal into the month cell bottom works, and a minimum row height of 148 px holds.
5. Our CSS wins over the theme classes after the `theme.css` import (ADR 0006).

Spec: "Spikes to run first".

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Each of the five checks has a result (pass or fail) in this file.
- [x] Each failed check has a named fallback.
- [x] Spike code is removed or kept outside `src`.

## Result

All five checks pass. Tested with FullCalendar `@fullcalendar/react` 7.1.3 in Chrome, time zone `Europe/Zurich`, real mouse drag. Spike code is in `.scratch/design-system-v2/spikes/` (it needs the repo root to run: move it to `spikes/` and open `/spikes/index.html` on the dev server).

1. **Mirror dates: pass.** During a drag, `eventContent` runs for the mirror (`isMirror`, `isDragging`) with `event.start` and `event.end` at the new time, as correct instants (a 1 h block dragged 2 h shows start +2 h, end +2 h). `timeText` is the new range too. Resize uses `isResizing` (same fields; not dragged by hand, same code path). So "Overlaps" can read `info.event.start/end` in the mirror.
2. **40 % source: pass.** While dragging, the source wrapper has inline `visibility: hidden`. A child with `visibility: visible; opacity: .4` shows at 40 % at the original place. Hook: `columnEventClass: (i) => i.isDragging && !i.isMirror && "wt-drag-source"`, and the content child sets `visibility: visible`.
3. **64 px per hour: pass.** With `slotDuration` 30 min and `slotMinHeight: 32`, an event at 09:00 and one at 17:00 are 512 px apart (8 h x 64). The 15 min event is 9 px tall inside its box (box 16 px less borders), so the 15 min block needs its own padding rule (ticket 19).
4. **Month cell bottom: pass, with one rule.** `dayCellDidMount` with `el.lastElementChild` plus `createPortal` renders into the bottom div of all 42 cells, and it sits at the cell bottom edge. The 148 px row height needs `min-height: 148px !important`: the skeleton sets `min-height: 0 !important` on the cell (utility class `.fc-OV`), so a normal rule loses. Pin `@fullcalendar/react` to an exact version because `lastElementChild` depends on internals.
5. **Our CSS wins: pass.** In dev and in a production build, our stylesheet comes after `theme.css`, `palette.css` and `skeleton.css`. A rule with one class (`.spike-single`) beat the theme background on an event, and `.wt-calendar .x` did too. Exceptions: anything the skeleton sets with `!important` (for example `min-height: 0` on the day cell) needs `!important` from us.

**Correction for the calendar tickets:** in v7 the event input class field is `className` (string), not `classNames`. The `classNames` name in research 02 is wrong for event inputs (check `src/Calendar.tsx` when you edit it).

No fallback is needed.
