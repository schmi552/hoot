---
status: accepted
amends: 0012, 0014
---
# A Workday change takes a start date

ADR 0014 hides the start date field when Expected per day does not change, and the save then starts today. ADR 0012 says a Workday save starts today. A save that changes only the Workdays keeps Expected per day the same, so both rules together would start it today. That would change the current week after the user has logged time in it. The field now shows when Expected per day or the Workdays change. It stays hidden for a change that touches neither, for example only the check-in interval, and for the first run. We did not follow the literal rule of ADR 0014, because story 27 says a Workday change starts on a date and ADR 0014 says all Work time fields share one date.

Known gaps: the form finds "today" in the schedule time zone, and the store uses the system date. `get_settings` returns only the row valid today, so a save that starts today can be overridden later by a row with a future start date.
