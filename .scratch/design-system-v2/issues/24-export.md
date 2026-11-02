# 24: Export

**What to build:** The export dialog has four presets: This week, Last week, This month and Last month. It says that the workbook has two sheets. Dates are text in dd.mm.yyyy. A Code column and a Category (name) column are added. Sheet 2 has one row per Category and day, and the day total is its own row. Absence rows keep ADR 0011. The file name is `work-tracker_YYYY-MM.xlsx` for a full month and `work-tracker_{from}_{to}.xlsx` for other ranges. After the export, "Show in folder" shows the file (a new Tauri command). After a failed export, "Try again" and "Choose another place" are available.

Spec stories: 112 to 119.

**Blocked by:** 09, 10

**Status:** done

- [x] Tests cover the export rows: Code column, sheet 2 shape, date text, and the file name rule for a full month and for other ranges.
- [x] The four presets set the correct ranges.
- [x] "Show in folder" opens the folder with the file selected on macOS and Windows.
- [x] A failed export shows both recovery actions.
- [x] The dialog matches the board in light and dark.
