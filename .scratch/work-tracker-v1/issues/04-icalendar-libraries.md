# 04: iCalendar libraries

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

Which libraries parse `.ics` files and expand RRULE in TypeScript or Rust (for example `ical.js`, `rrule`, `rrule-rust`)? How do they handle exceptions (RECURRENCE-ID, EXDATE), time zones (VTIMEZONE to local time) and large files? Which one lets us store one rule and expand it for a visible date range?

## Answer

Findings are on the branch `research/icalendar-libraries` (`.scratch/work-tracker-v1/research/04-icalendar-libraries.md`). The branch is never merged.

- Do the `.ics` work in TypeScript. Use `ical.js` to parse and `rrule-temporal` to store one rule and expand it for a date range.
- Avoid the JS `rrule` package (unmaintained, time-zone problems) and `rrule-rust` (a Node add-on, so it cannot run in a Tauri web view).
- No rule library supports `RECURRENCE-ID`. Store exception dates and overrides in our own tables.
- Main risk is time zones: a `TZID` with no `VTIMEZONE` is read as floating time, and Windows zone names fail in the rule libraries.
- Open for the Data model ticket: where recurrence expansion lives, because the export runs in Rust.
