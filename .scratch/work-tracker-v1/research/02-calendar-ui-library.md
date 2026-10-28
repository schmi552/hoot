# Research 02: Calendar UI library

Ticket: `.scratch/work-tracker-v1/issues/02-calendar-ui-library.md`
Date of research: 2026-10-28

## Recommendation

Use **FullCalendar v7** (`@fullcalendar/react` 7.1.3, MIT) with the `rrule` plugin.

- It is the only option in this study where week and month views, drag and drop, resize, 15-minute snap and RRULE expansion are all free and all in one MIT package set.
- The licence has no limit for this use. The paid tier (Premium) adds only timeline and resource views. v1 does not need them.
- No library gives per-occurrence exceptions as a stored feature. The app must store each exception in SQLite and give the result to the calendar as events. This is true for every option, including a custom grid.
- No library gives hotkeys for copy, paste, duplicate and delete, or keyboard-only move and resize. The app must build these.
- Schedule-X is the second choice, but drag and drop and resize are paid plugins there (EUR 479 per year or EUR 999 once). React Big Calendar has no recurrence. Toast UI Calendar is archived.
- A custom grid is a valid fallback. It costs the most work and the most accessibility risk.

Open points to confirm in a prototype (see "What to test first"): the exact `eventDrop` data for a dragged rrule occurrence, and the WebView behaviour inside Tauri.

## Scope of the comparison

v1 needs these features (source: `.scratch/work-tracker-v1/issues/01-product-scope-and-behaviour.md`, `docs/project_outline.md`):

1. Week view and month view.
2. Drag and drop of Entries.
3. Resize of Entries.
4. Hotkeys: copy, paste, duplicate, delete.
5. 15-minute snap.
6. Recurring Meetings stored as one RRULE, with changed occurrences as exceptions and deleted occurrences as skipped dates.
7. Later: `.ics` import with RRULE, exceptions and cancelled dates.

Options compared: FullCalendar, React Big Calendar, Schedule-X, Toast UI Calendar, and a custom grid.

## Summary table

| Item | FullCalendar 7.1.3 | React Big Calendar 1.20.0 | Schedule-X 4.x | Toast UI Calendar 2.1.3 | Custom grid |
| --- | --- | --- | --- | --- | --- |
| Licence for v1 features | MIT | MIT | MIT core. Drag and drop and resize are Premium (paid) | MIT | Own code. `@dnd-kit/core` MIT, `rrule` BSD-3-Clause |
| Week and month views | Yes | Yes | Yes | Yes | Build it |
| Drag and drop | Yes, free | Yes, add-on, free | Premium plugin | Yes | Build it (dnd-kit helps) |
| Resize | Yes, free | Yes, in the DnD add-on (on by default) | Premium plugin | Yes | Build it |
| 15-minute snap | `snapDuration` | `step` (default 30) | DnD interval: 15, 30 or 60 | Not checked in a primary source | Build it |
| RRULE | `@fullcalendar/rrule` plugin (rrule 2.x) | None | Own plugin, partial RFC 5545 | Not found in README | Use `rrule` |
| EXDATE | Yes, since 5.5.0, only for object-form rule | None | Yes, `exdate` | Not found | Own logic |
| Per-occurrence edit | App logic | App logic | App logic | App logic | App logic |
| Last npm release | 2026-10-16 | 2026-06-01 | 2026-09-29 (core) | 2022-08-16 | n/a |
| Maintenance | Active | Active | Active | Archived on 2026-09-02 | You |
| Gzip size, JS (see below) | about 77 KB | about 92 KB | about 58 KB without paid plugins | not measured | about 26 KB |

## Sizes

I built each option with esbuild (minified, production mode, tree shaking on) on 2026-10-28. The test imported the week view, the month view, the recurrence code, and the drag plugin where it is free. Gzip level 9.

| Option | JS gzip, React included | JS gzip, React removed (about 45.5 KB) | CSS gzip |
| --- | --- | --- | --- |
| FullCalendar 7.1.3 (react, daygrid, timegrid, interaction, classic theme, rrule plugin) | 144.6 KB, with `rrule` (14 KB) and `temporal-polyfill` (20.5 KB) bundled | 77.0 KB with React, rrule and temporal external. Add 14 KB and 20.5 KB for the two libraries | skeleton 2.4 KB, plus theme files |
| React Big Calendar 1.20.0 (Calendar, DnD add-on, rrule) | 137.1 KB | about 91.6 KB (includes `rrule`, 14 KB) | 3.1 KB, plus 0.5 KB for DnD |
| Schedule-X 4.9.1 (react wrapper, week, month grid, event-recurrence) | 103.3 KB | about 57.8 KB. The paid drag and resize plugins are not in this number | 5.9 KB |
| Custom: `@dnd-kit/core` and `rrule` | 71.2 KB | about 25.7 KB | Own CSS |

Notes:

- These are my own measurements, not vendor numbers. Treat them as order of magnitude. A real app also adds date-fns or similar.
- All sizes are acceptable for a Tauri app. The app loads from disk, not over a network. Size is a weak reason to choose or reject any option.
- FullCalendar v7 and Schedule-X both need a Temporal polyfill (`temporal-polyfill`, about 20 KB gzip). The FullCalendar v7 `package.json` lists it as a peer dependency. The Schedule-X docs say most users must polyfill Temporal.
- Do not mix versions. FullCalendar v7 puts `daygrid`, `timegrid` and `interaction` inside `@fullcalendar/react` as subpaths. The separate `@fullcalendar/daygrid` packages on npm (latest tag 6.1.22) are v6. The v7 README says to not install them together.

## FullCalendar

### Licence

- The standard packages and the `fullcalendar` bundle are MIT. Source: https://fullcalendar.io/license and `LICENSE.md` in https://github.com/fullcalendar/fullcalendar (MIT, Copyright 2026 Adam Shaw).
- Premium (Scheduler) adds timeline and vertical resource views, and print rendering. It starts at USD 480 for 1 to 10 developers. Source: https://fullcalendar.io/pricing. v1 needs none of these.
- The `@fullcalendar/timeline` npm package has the licence "SEE LICENSE IN LICENSE.md" (npm registry). Do not install it.

### Features against the v1 list

- **Views.** `dayGridMonth`, `timeGridWeek`, `timeGridDay` and others. Source: `packages/react/README.md` in the repo.
- **Drag and resize.** The `interaction` plugin gives both. Set `editable` to true. The callbacks are `eventDrop` and `eventResize`. Source: https://fullcalendar.io/docs/event-dragging-resizing.
- **Snap.** `snapDuration` sets the drag and select step. If you do not set it, it uses `slotDuration`, which defaults to 30 minutes. Set `snapDuration: '00:15:00'`. Source: https://fullcalendar.io/docs/snapDuration.
- **RRULE.** The `@fullcalendar/rrule` plugin uses the `rrule` library. An event can have `rrule` as an object or an RRULE string. Source: https://fullcalendar.io/docs/rrule-plugin.
- **Exceptions.** `exdate` and `exrule` skip dates. They work only when `rrule` is an object. With a string rule, put the exclusions inside the string. Source: same page.
- **Link between occurrences.** Events with the same `groupId` move together. Without `groupId`, each occurrence moves alone. Source: https://fullcalendar.io/docs/recurring-events.

### What it makes hard

1. **Per-occurrence edits are app work.** The docs do not describe how to edit one occurrence. FullCalendar reports the drag or resize of one instance. The app must then write an exception row and an EXDATE (or a skipped date), and send the new event list back. I did not find a primary source that shows the exact `eventDrop` data for an rrule occurrence. Test it.
2. **No keyboard drag or resize.** The accessibility page says events become tabbable when `eventInteractive` is true, and that elements have ARIA and `title` labels. It does not say that events can be moved or resized with the keyboard. Source: https://fullcalendar.io/docs/accessibility. The v7.1.2 changelog lists screen reader fixes: lists with `role="list"`, tables instead of grids, and visually hidden date text. Source: `CHANGELOG.md`. For keyboard shortcuts, the app must add its own `keydown` handler and an "active Entry" state.
3. **Hotkeys are app work.** Copy, paste, duplicate and delete are not library features. Use a global key handler and the selected event.
4. **Rules for no overlap are app work.** Entries must not overlap each other, but a manual Entry may overlap a Meeting. Use the `eventAllow` or `eventOverlap` options, or check in `eventDrop`. I did not verify these options in a primary source for v7. Check them in the prototype.
5. **Minute precision in the popup.** Popup Entries keep minute precision. The grid can show them. Only dragging snaps. This looks possible but is not tested.
6. **Temporal.** v7 uses the Temporal API and needs `temporal-polyfill`. The app must handle time zones and DST on conversion from SQLite times.
7. **`.ics` import.** FullCalendar has an iCalendar package (`packages/icalendar` in the repo). Ticket 04 covers import. The app should still parse once at import and store its own rows.

## React Big Calendar

### Licence and status

- MIT. Version 1.20.0, published 2026-06-01 (npm registry). Source: https://github.com/jquense/react-big-calendar.
- You must pick a date localizer: Moment.js, Globalize.js, date-fns or Day.js. Source: README.

### Features against the v1 list

- **Views.** Month, week, day, agenda.
- **Drag and drop, resize.** The add-on `react-big-calendar/lib/addons/dragAndDrop` is free. In the source, `resizable` defaults to `true` (`src/addons/dragAndDrop/withDragAndDrop.js`).
- **Snap.** The `step` prop sets minutes per slot. The default is 30 (`src/Calendar.js`). `timeslots` sets slots per section. Set `step={15}`.
- **Recurrence.** None. A search of the README, docs and `src` found no recurrence feature. The app must expand RRULE itself (with `rrule`) and give the occurrences as events.
- **Keyboard.** There is an `onKeyPressEvent` prop and an `onKeyDown` in the event cell code (`src/EventCell.js`). This is for key presses on a focused event, not for keyboard move or resize.

### What it makes hard

1. **Recurrence is fully the app's job.** The app expands every rule for the visible range and handles exceptions. This is the same work as in a custom grid, but only for the data layer.
2. **Accessibility is thin.** I found few ARIA attributes in `src` (for example `aria-label="Month View"`). The README does not describe screen reader support. Check with a real screen reader before choosing this option.
3. **Styling.** The README says the container needs an explicit height. Styling uses SASS files.
4. **Month view drag.** The drag add-on works in month view for date moves. Time snap applies only in time grid views. Not tested.

## Schedule-X

### Licence and cost

- Core packages are MIT (`LICENSE`, Copyright 2023 Tom Osterlund; npm registry).
- **Drag and drop and resize are Premium.** The docs pages for both plugins say: "This is a premium plugin which requires an active license". The npm names are `@sx-premium/drag-and-drop` and `@sx-premium/resize`. Source: `website/app/docs/calendar/plugins/drag-and-drop/page.mdx` and `.../resize/page.mdx` in https://github.com/schedule-x/schedule-x.
- Price: EUR 479 per year plus VAT, or EUR 999 once plus VAT (lifetime licence with 1 year of support and updates). The licence is per project. Source: https://schedule-x.dev/premium (fetched 2026-10-28). A yearly licence must be paid for as long as you use the software.
- For a free personal tool, this is a real cost. It also adds an `.npmrc` token in the build. Source: `docs/calendar/installing-premium/page.mdx`.

### Features against the v1 list

- **Views.** Week, month grid and others.
- **Snap.** The DnD interval is 15 (default), 30 or 60 minutes. Source: drag-and-drop page. The resize plugin takes an interval in minutes too.
- **Recurrence.** The free `@schedule-x/event-recurrence` plugin gives a partial RFC 5545 implementation: FREQ, COUNT, INTERVAL, BYDAY, BYMONTHDAY, UNTIL, WKST, and `exdate` in floating date or date-time format. Source: `website/app/docs/calendar/plugins/recurrence/page.mdx`.
- **Own warning from the docs.** If you use the external `rrule` library, you cannot use drag and drop or resize. Use the plugin if you want those.

### What it makes hard

1. **Paid core interactions** (see above).
2. **Limits on dragging recurring events.** Events with `BYDAY` and a position (for example `1MO`) cannot be updated by drag. Source: recurrence and drag-and-drop pages. `.ics` rules from other tools often use `BYDAY`. These items need a custom edit form.
3. **Partial RRULE.** Rules the plugin does not support need a workaround. `.ics` import (ticket 04) may hit them.
4. **Per-occurrence edits.** The docs show `exdate` only. The app must still store overrides.
5. **Temporal polyfill needed.**
6. **Keyboard.** Only a few keyboard handlers exist in the source (event components, view selection). No documented keyboard move or resize.

## Toast UI Calendar

- MIT. The GitHub repo shows "archived by the owner on Sep 2, 2026" and is read-only. The last npm release (`@toast-ui/calendar` 2.1.3) is from 2022-08-16. Sources: https://github.com/nhn/tui.calendar and the npm registry.
- It has drag, resize and a React wrapper (`@toast-ui/react-calendar`).
- The README does not mention recurrence or accessibility.
- Reject it. An archived library with no updates since 2022 is a poor base for a new app.

## Custom grid

The stack would be React, `@dnd-kit/core` (MIT, 6.3.1, last release 2024-12-05) or pointer events, and `rrule` (BSD-3-Clause, 2.8.1, last release 2023-11-10).

Benefits:

- Smallest bundle: about 26 KB gzip without React (my measurement).
- Full control of the rules in `01-product-scope-and-behaviour.md`: no overlap between Entries, 15-minute snap, one RRULE with exceptions, a partial-day Absence display, and the daily total.
- Fewer layout rules, because Entries never overlap each other. Only Meetings can overlap Entries.

Costs (my judgement, not from a primary source):

- You build the week grid, the month grid, the all-day row, the "more" popover, multi-day Absences, scroll position, now-line, DST and week-start handling.
- You build drag, resize, auto-scroll, touch handling, cancel with Escape, and a11y for all of them.
- `rrule` 2.8.1 has had no release since 2023-11-10. Check its time zone handling (see ticket 04).
- Expect weeks of work, not days, before parity with FullCalendar.

A custom grid also needs the same app-side exception model as the other options. It removes only the library fit risk.

## Cross-cutting findings

- **Recurrence model.** All options expand an RRULE for the visible range. None stores exceptions for you. Store, in SQLite: the rule, a list of skipped dates, and override rows keyed by (rule id, original start). Then build the event list for the visible range. This model also fits ticket 05 (data model) and ticket 07 (calendar interactions).
- **Keyboard.** No option gives hotkeys or keyboard move and resize. The app must add them. Ticket 07 must decide the gestures.
- **Drag of a recurring occurrence.** Decide in ticket 07 what the user sees: "this occurrence" or "all occurrences". FullCalendar `groupId` gives "all" for free. The "this occurrence only" case needs app code in every option.
- **Tauri WebView.** The app runs in WKWebView on macOS and WebView2 on Windows. I did not test any library in these. Test drag, resize and touch in both before the spec is final.

## What to test first (prototype, ticket 06 or a new ticket)

1. FullCalendar v7 with `timeGridWeek`, `dayGridMonth`, `snapDuration: '00:15:00'` and `editable: true`, in Tauri on macOS and Windows.
2. An rrule Meeting with `exdate`: drag one occurrence and read the `eventDrop` data. Write an exception row. Render again.
3. `eventAllow` or `eventOverlap` for the rule "Entries never overlap".
4. A global `keydown` handler for copy, paste, duplicate and delete on a selected event.
5. A screen reader pass (VoiceOver and NVDA) on the week view.

## Not evaluated

- DayPilot Lite, Bryntum, Syncfusion, DHTMLX, Mobiscroll and similar. Most are commercial or have a free tier with limits. I excluded them to keep the licence simple for a personal tool. I did not read their licences.
- Native `<input type="datetime-local">` pickers. They are not calendar views.

## Sources

Primary sources used:

- FullCalendar: https://fullcalendar.io/license, https://fullcalendar.io/pricing, https://fullcalendar.io/docs/rrule-plugin, https://fullcalendar.io/docs/snapDuration, https://fullcalendar.io/docs/slotDuration, https://fullcalendar.io/docs/event-dragging-resizing, https://fullcalendar.io/docs/recurring-events, https://fullcalendar.io/docs/accessibility
- FullCalendar repo (shallow clone at v7.1.3): `CHANGELOG.md`, `LICENSE.md`, `packages/react/README.md`, `packages/react/package.json`, `packages/rrule/README.md`
- React Big Calendar repo (shallow clone, 1.20.0): `README.md`, `src/Calendar.js`, `src/addons/dragAndDrop/withDragAndDrop.js`, `src/EventCell.js`, `package.json`
- Schedule-X repo (shallow clone): `LICENSE`, `website/app/docs/calendar/plugins/recurrence/page.mdx`, `.../drag-and-drop/page.mdx`, `.../resize/page.mdx`, `.../installing-premium/page.mdx`, `.../temporal/page.mdx`; and https://schedule-x.dev/premium
- Toast UI Calendar: https://github.com/nhn/tui.calendar
- npm registry (versions, licences, publish dates): `registry.npmjs.org` for the packages named above
- Bundle sizes: my own esbuild build on 2026-10-28

Method notes: several web pages were read through a summarising fetch tool, not as raw text. Where a page did not state a fact, this file says so and does not guess. Statements marked "not tested" or "not verified" need a prototype check.
