# Expand recurring Meetings in TypeScript only

The database stores one RRULE per recurring Meeting. TypeScript expands it for a date range with `rrule-temporal`. The export command receives the already-expanded rows from the UI, and Rust only writes the workbook. We did not add a second expansion in Rust. Two implementations can disagree, and the export must match what the user sees on screen.

Consequence: the export needs the UI layer to run. This is acceptable because the user starts the export from the UI.
