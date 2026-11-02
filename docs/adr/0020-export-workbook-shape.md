---
status: accepted
---
# The export has one row per Category and day, a Code column and dd.mm.yyyy text dates

Sheet 2 ("Hours per day") has one row per Category and day, followed by the day total as its own row named "Total". Each row has Date, Location, Code, Category and Hours. A day with no Entry still has a Total row of 0. Sheet 1 gets a Code column before Category. A Meeting without a Category and every Absence row have an empty Code. Absence rows still stay out of sheet 2 (ADR 0011). Dates in both sheets are text in dd.mm.yyyy, and Rust formats them from the ISO dates that the UI sends.

The file name is `work-tracker_YYYY-MM.xlsx` for a full month and `work-tracker_{from}_{to}.xlsx` for other ranges. The range uses ISO dates, not dd.mm.yyyy, so that the files sort by name.

We chose rows over one column per Category so that the user can filter by PSP code and sum by Category. A column per Category cannot do this when the Category list changes. We kept the sheet name "Hours per day" to keep the sheet name stable for existing workbooks that read it. This changes the "same columns as Entries" line of ADR 0011: Absence rows now carry the Code column, empty.
