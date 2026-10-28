# 04: iCalendar libraries

Ticket: [04-icalendar-libraries](../issues/04-icalendar-libraries.md)
Date: 2026-10-28

## Recommendation

Do the `.ics` work in TypeScript, in the React front end. Use two libraries:

1. **`ical.js`** (2.2.1, MPL-2.0, no dependencies, ships types) to parse `.ics` files on import.
2. **`rrule-temporal`** (2.2.8, MIT) to expand a stored rule for the visible date range.

Why:

- `rrule-temporal` takes one rule string (`DTSTART;TZID=...` plus `RRULE`) and has `between(after, before)`. This matches "store one rule, expand it for a visible range". It also takes `exDate` and returns time-zone aware `Temporal.ZonedDateTime` values.
- `ical.js` is the only library in this study that reads `VTIMEZONE`, `RECURRENCE-ID` and `EXDATE` from a real file. We use it only at import time.
- We store exceptions in our own tables (see "Proposed storage"). We do not need a library to merge them at display time.

Do not use:

- `rrule` (2.8.1). The last release is from November 2023. The maintainers asked for a rewrite because its `Date` approach makes time zones hard. Its results carry wall-clock time in the UTC fields of `Date`.
- `rrule-rust` (3.1.1) in the web view. It is a Node native add-on. A Tauri web view is not Node. See "Rust options".

Two risks need an owner (see "Open items"): Windows time-zone names in Outlook files, and the `Temporal` polyfill in the web views.

## Question 1: Which libraries exist?

| Library | Language | Version (date) | Licence | Parses `.ics` | Expands RRULE | Source |
|---|---|---|---|---|---|---|
| `ical.js` | TS/JS | 2.2.1 (2025-08-08) | MPL-2.0 | Yes | Yes (`RecurExpansion`) | [1][2] |
| `rrule` | TS/JS | 2.8.1 (2023-11-10) | BSD-3-Clause | Rule strings only | Yes | [3][4] |
| `rrule-temporal` | TS/JS | 2.2.8 (2026-10-01) | MIT | Rule strings only | Yes | [5][6] |
| `rrule-rust` | Node add-on over Rust | 3.1.1 (2026-02-08) | MIT | Rule strings only | Yes | [7][8] |
| `ical-expander` | JS wrapper over `ical.js` | 3.2.0 (2025-10-02) | MIT | Yes | Yes | [9][10] |
| `rrule` crate | Rust | 0.14.0 (2025-04-20) | MIT or Apache-2.0 | Rule strings only | Yes | [11][12] |
| `ical` crate | Rust | 0.11.0 (2024-03-13) | Apache-2.0 | Yes, no validation | No | [13][14] |
| `icalendar` crate | Rust | 0.17.17 (2026-10-26) | see crate | Builder and parser | No | [15][16] |
| `calcard` crate | Rust | 0.3.14 (2026-09-15) | Apache-2.0 | Yes | Yes | [17][18] |

Notes:

- `ical.js` is a parser. Its README lists RFC 5545, 7265 (jCal), 6350 and 7095 as its scope. It has no dependencies [2].
- `calcard` is archived. Its README says development moved into the Stalwart repository. Version 0.3.14 is the last one from the old repository [18]. Do not start new work on it.
- The `ical` crate README says its parsers "only parse the content". It makes "no checks ... on the fields' validity" [14]. It has no expansion.
- The `icalendar` crate README calls it "A builder and parser" [16]. We found no expansion in it.
- The "fully compliant" claim in the `rrule-temporal` README is the author's own claim. We did not audit it against the RFC test suites.

## Question 2: Exceptions (RECURRENCE-ID, EXDATE)

### What the standard says

- The recurrence set is all start times from `RRULE` and `RDATE`, minus the start times in `EXDATE`. "EXDATE ... take precedence over" the inclusion properties [19, section 3.8.5.1].
- `DTSTART` is the first instance. If `DTSTART` does not match the rule, the result is "undefined" [19, section 3.8.5.1].
- `RECURRENCE-ID` marks one changed instance. Its value is "the original value of the DTSTART property of the recurrence instance". If a Friday meeting moves to Thursday, the value stays the Friday date-time [19, section 3.8.4.4].
- `RECURRENCE-ID` works with `UID` and `SEQUENCE`. It has the optional parameter `RANGE=THISANDFUTURE`. This parameter moves all later instances by the same time difference [19, section 3.8.4.4].
- The `RECURRENCE-ID` value type must match `DTSTART`. A floating `RECURRENCE-ID` is allowed only if `DTSTART` is floating [19, section 3.8.4.4].

### What each library does

| Library | EXDATE | RECURRENCE-ID overrides |
|---|---|---|
| `ical.js` | `RecurExpansion` reads `EXDATE`, keeps a sorted list and skips matches. If `DTSTART` is a date-time and the `EXDATE` is a date, it compares only the day [20]. | `Event.relateException()` links an override to the master event by `UID`. `getOccurrenceDetails()` returns the override data for that occurrence [21]. `modifiesFuture()` tests `RANGE=THISANDFUTURE` [21]. |
| `rrule` | `RRuleSet.exdate()` removes a date even if a rule makes it [3]. | None. Rule engine only. |
| `rrule-temporal` | Option `exDate` [5]. | None. Rule engine only. |
| `rrule-rust` | `ExDate` class and `addExDate` [8]. | None. |
| `rrule` crate | `exdate` on `RRuleSet` [12]. | None. |
| `ical-expander` | Handles `EXDATE` and `RECURRENCE-ID` by wrapping `ical.js` [10]. | Yes, through `ical.js`. |

I ran a test with `ical.js` 2.2.1 and a weekly Tuesday 09:00 Europe/Berlin series. It had one `EXDATE` (27 Oct 2026) and one `RECURRENCE-ID` override (3 Nov moved to Wednesday 4 Nov at 14:00). The output was correct: the 27 Oct instance was gone, and the 3 Nov instance was replaced by the 4 Nov override.

The "THISANDFUTURE" range is the hard part. `ical.js` exposes `modifiesFuture()`, but I did not find in its documentation that `getOccurrenceDetails()` shifts later instances for you. Treat this as unverified. The simple fix is in our model: when the user edits "this and following", split the series into two rules.

## Question 3: Time zones (VTIMEZONE to local time)

### What the standard says

- `TZID` must be on `DTSTART`, `DTEND`, `EXDATE` and `RDATE` when the value is not UTC and not floating. The file must hold one `VTIMEZONE` for each `TZID` [19, section 3.2.19].
- A date-time with no `TZID` and no `Z` is "floating". It means the same wall-clock time in whatever zone the reader is in. This holds "regardless of the existence of VTIMEZONE" [19, sections 3.2.19, 3.3.5].
- The standard does not define a naming scheme for `TZID`. It only suggests the public-domain TZ database [19, section 3.2.19].

### What each library does

- **`ical.js`**: The stock build "does not register any timezones". You must register the `VTIMEZONE` blocks from the file, or add `ical.timezones.js`, which is not in the npm package [2].
  - Test A: with `VTIMEZONE` registered via `ICAL.TimezoneService.register`, a file with `TZID:W. Europe Standard Time` gave correct UTC times, including the DST change. The result did not depend on the computer time zone.
  - Test B: a file with `TZID=Europe/Berlin` and **no** `VTIMEZONE` was read as **floating**. `toJSDate()` then used the computer's time zone. On a Berlin computer the result looked correct. With `TZ=America/New_York` the same file gave 13:00 UTC, not 07:00 UTC. This silent error is the main import risk.
- **`ical-expander`** adds the IANA zone table to `ical.js` so that missing `VTIMEZONE` blocks do not break parsing [10]. It is an option if we want a ready-made fix, but it adds a wrapper that runs synchronously [10].
- **`rrule` (JS)**: Without `tzid`, times are floating or UTC. "returned UTC values should be read as your local wall-clock time". The `tzid` option uses `Intl` [3]. A maintainer wrote that time-zone support is "nearly impossible with the funky behavior of builtin Date" [22].
- **`rrule-temporal`**: Takes `DTSTART;TZID=<IANA name>` and returns `Temporal.ZonedDateTime` [5]. In my test the Berlin weekly series gave `+02:00` before 25 Oct 2026 and `+01:00` after. It does not accept the Windows name `W. Europe Standard Time` (error "Invalid DTSTART").
  - Gap rule: local times inside a DST gap are omitted, as RFC 5545 requires [5]. Test: a daily 02:30 Berlin rule skipped 29 Mar 2026.
- **`rrule-rust` and the `rrule` crate**: Time zones come from `chrono-tz` (the IANA database) [11]. They do not read `VTIMEZONE`. `W. Europe Standard Time` gave the error "Invalid timezone". In the DST-gap test it moved 02:30 to 03:30 on 29 Mar 2026. That differs from `rrule-temporal` (see "Open items").

Consequence for the design: at import, convert each `TZID` to an IANA name and store that name with the rule. Expand later with `rrule-temporal`. Use `VTIMEZONE` only to check that a name is known, or to map unknown names.

## Question 4: Large files

I tested with Node 25.8.1 on an Apple arm64 computer. These numbers show size, not a benchmark suite.

| Test | Result |
|---|---|
| `ical.js` parse, 5000 `VEVENT` blocks (769 KB) | 18 ms |
| `ical.js` expand 1 week from 5000 weekly rules, `DTSTART` in 2026 | 1732 ms |
| 500 weekly rules (Mon, Wed) with `DTSTART` in 2016, range = 1 week, `rrule-temporal` | 29 ms |
| Same, `rrule-rust` | 95 ms |
| Same, `ical.js` (walks from `DTSTART`) | 2997 ms |

Reading:

- Parsing is not a problem for a personal calendar.
- `ical.js` expansion starts at `DTSTART` and walks forward. `ical-expander` warns that its work is synchronous and "will block the JS event loop", with a default `maxIterations` of 1000 [10]. This cost grows with the age of the series.
- `rrule-temporal` was about 100 times faster in this test. It has safety caps: `maxIterations` (10,000) and `maxCandidateEvaluations` (1,000,000) [5].
- The Rust `rrule` crate has a limit on `all()` of at most 65,535 results and a default iteration limit of 100,000. Its `RRuleResult` has a `limited` flag [11][12]. Its README says to read the security notes if input comes from users [11]. An imported `.ics` file is user input.
- Note: in `rrule-rust` and the Rust crate, the `after`/`before` range applies to `all()` but "will not be used if you use the `Iterator` API directly" [12].

## Question 5: Which one stores one rule and expands for a visible range?

All three rule engines do this. They take one rule and return occurrences in a range:

- `rrule-temporal`: `rule.between(after, before, inclusive)` [5]. Round trip with `toString()` [5].
- `rrule` (JS): `between(after, before, inc)`; `toString()` and `fromString()` [3].
- `rrule-rust`: `RRuleSet.between(after, before, inclusive)`; `toString()`; `fromString()` [8].
- `rrule` crate: `RRuleSet` with `after`/`before`, then `all(limit)` [12].
- `ical.js`: no range query. You call `iterator()` and `next()` from the start and stop at the end of the range [21][20].

`rrule-temporal` fits best because the text form (`DTSTART;TZID=...\nRRULE:...`) is easy to keep in one SQLite column. It also supports `exDate` and `rDate`.

## Rust options

If we want the expansion in the Tauri back end:

- The `rrule` crate does the work (`RRuleSet`, `exdate`, `after`/`before`, `all(limit)`). Dates are limited to years +/-262,000 and to the zones in `chrono-tz` [11].
- Parsing in Rust needs the `ical` crate, which has no validation and no `VTIMEZONE` handling that I could find [14]. We would write the exception merge and the zone mapping ourselves.
- A call from the web view to Rust adds an IPC call for each redraw of the calendar. The data is small, but it adds code in two languages.

`rrule-rust` is not an option in the web view. Its npm package lists native add-ons (`@rrule-rust/lib-darwin-arm64`, `lib-win32-x64-msvc` and others) and requires Node 20 or newer. It also lists a `wasm32-wasi` package [8]. I did not test the WASM package in a Tauri web view.

## Proposed storage (for the data-model ticket)

This is a suggestion that follows from the findings. It is not a decision.

- Series table: `dtstart_local` (wall-clock text), `tzid` (IANA), `duration`, `rrule` (text, no `DTSTART`), `category`.
- Exception-date table: `series_id`, `original_start`. The user "deletes one occurrence" by adding a row. We pass these rows to `exDate`.
- Override table: `series_id`, `original_start` (the `RECURRENCE-ID`), new start, new duration, new category, new text. The user "edits one occurrence" by adding a row. At display time, replace the matching expanded occurrence.
- For "this and following": cut the old rule with `UNTIL` and create a new series. This avoids `RANGE=THISANDFUTURE`.
- Per RFC 5545, `UNTIL` must be UTC when `DTSTART` has a `TZID` [5]. Keep this in mind when we cut a series.

## Open items

1. **Windows zone names.** Outlook-style files use names like `W. Europe Standard Time`. Neither `rrule-temporal` nor `rrule-rust` accepts them. We need a mapping table to IANA names. The usual source is the Unicode CLDR `windowsZones.xml`. I did not verify this file here. A ticket should check it.
2. **Unknown `TZID` with no `VTIMEZONE`.** `ical.js` treats it as floating (Test B). The import code must detect this and ask the user or use the system zone.
3. **`Temporal` in the web views.** `rrule-temporal` uses `Temporal` types and a polyfill (`temporal-polyfill`) [5]. I did not check native `Temporal` support in WKWebView or WebView2. The ticket on Tauri capabilities should check the polyfill size and speed.
4. **DST gap behaviour.** `rrule-temporal` skips a non-existent local time. The Rust crate moves it forward. A user with a 02:30 daily rule sees a different result. Pick one behaviour and write a test.
5. **Licence.** `ical.js` uses MPL-2.0. This is a file-level licence. It is fine for an app that does not change the library files. Confirm with the owner.
6. **`THISANDFUTURE`.** On import, decide whether to split such overrides into new series or to ignore the range.

## What I did not do

- I did not run the RFC 5545 test cases against each library.
- I did not test `ical-expander`, `ical` crate, `icalendar` crate or `calcard`. Their rows come from their READMEs and registry data.
- I did not test the WASM build of `rrule-rust`.

## Sources

Primary sources only: standards, repositories, official API docs and package registries.

1. npm registry, `ical.js`: https://registry.npmjs.org/ical.js
2. `ical.js` README: https://github.com/kewisch/ical.js
3. `rrule` README: https://github.com/jkbrzt/rrule
4. npm registry, `rrule`: https://registry.npmjs.org/rrule
5. `rrule-temporal` README: https://github.com/ggaabe/rrule-temporal
6. npm registry, `rrule-temporal`: https://registry.npmjs.org/rrule-temporal
7. npm registry, `rrule-rust`: https://registry.npmjs.org/rrule-rust
8. `rrule-rust` README and package type definitions: https://github.com/lsndr/rrule-rust
9. npm registry, `ical-expander`: https://registry.npmjs.org/ical-expander
10. `ical-expander` README: https://github.com/mifi/ical-expander
11. `rrule` crate README: https://github.com/fmeringdal/rust-rrule
12. `rrule` crate API: https://docs.rs/rrule/0.14.0/rrule/struct.RRuleSet.html
13. crates.io, `ical`: https://crates.io/crates/ical
14. `ical` crate README: https://github.com/Peltoche/ical-rs
15. crates.io, `icalendar`: https://crates.io/crates/icalendar
16. `icalendar` crate README: https://github.com/hoodie/icalendar-rs
17. crates.io, `calcard`: https://crates.io/crates/calcard
18. `calcard` README: https://github.com/stalwartlabs/calcard
19. RFC 5545, Internet Calendaring and Scheduling Core Object Specification: https://www.rfc-editor.org/rfc/rfc5545
20. `ical.js` source, `recur_expansion.js`: https://github.com/kewisch/ical.js/blob/main/lib/ical/recur_expansion.js
21. `ical.js` API, `ICAL.Event`: https://kewisch.github.io/ical.js/api/ICAL.Event.html
22. `rrule` issue 450, maintainer statement on time zones: https://github.com/jkbrzt/rrule/issues/450
