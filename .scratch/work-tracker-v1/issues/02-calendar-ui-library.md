# 02: Calendar UI library

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

Which React calendar library, if any, supports week and month views, drag and drop, resize, keyboard shortcuts, RRULE recurring items with per-occurrence exceptions, and 15-minute snap? Compare FullCalendar, a custom grid, and at least two other options. Report licence limits, bundle size, accessibility, and which v1 features each one makes hard.

## Answer

Findings are on the branch `research/calendar-ui-library` (`.scratch/work-tracker-v1/research/02-calendar-ui-library.md`). The branch is never merged.

- FullCalendar v7 (MIT) with the `rrule` plugin gives week and month views, drag and drop, resize, a 15-minute snap and EXDATE for free. Only timeline and resource views are paid.
- Schedule-X needs paid plugins for drag and resize. React Big Calendar has no recurrence. Toast UI Calendar is archived.
- No option stores per-occurrence exceptions or gives keyboard move and resize. We build both.
- Not verified, so a prototype must check: `eventDrop` data for a dragged `rrule` occurrence, `eventAllow` and `eventOverlap` for "Entries never overlap", and behaviour in the macOS and Windows web views.
