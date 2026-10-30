# A full-day Absence is one export row per day, with no hours

Sheet 1 of the workbook shows each full-day Absence as one row for each day inside the chosen timeframe. A part-day Absence is one row on the day it starts. This differs from "one row per Absence" in ticket 25. We chose it so that the Location column is right for each day, the dates stay inside the timeframe, and the sheet matches the calendar.

An Absence row has an empty Hours cell and the category "Absence (not worked)". A full-day Absence has no start or end. We did not count Absence hours, because 24 hours per day is not work time, and a work-hours figure would need the rule of `expectedOn` in the export. The flag `absence` on each row tells Rust to keep these rows out of sheet 2. We did not add a Type column, because the ticket asks for the same columns as Entries.

Weekend days inside a vacation get a row too. The calendar shows them as Absence days, and the export follows the calendar.
