# 19: Excel export

**What to build:** The user picks a timeframe and exports one Excel workbook of Entries.

**Blocked by:** 17 Workday location

**Status:** resolved

- [x] The user picks a start and an end date.
- [x] Sheet 1 has one row per Entry with date, start, end, duration, Category, description and location. Sheet 2 has hours per Category per day and the Workday location of each day.
- [x] The UI sends the rows to a Rust export command. Rust uses `rust_xlsxwriter` (ADR 0002).
- [x] Rust writes to a temporary file in the target folder and renames it over the target.
- [x] A failed export leaves no partial file and keeps an older export. The dialog stays open, shows the plain reason, and offers Try again and Choose another place.
- [x] Rust command tests read the workbook back and check both sheets, and check that a forced failure leaves no partial file.
