---
status: accepted
---
# The week grid shows work hours plus one hour, and the days that hold items

The week grid runs from work start minus one hour to work end plus one hour. It widens in full hours to show any timed Entry, Meeting or part-day Absence outside this range. A full-day Absence has its own row and does not widen the grid. The grid has 64 px per hour, so it shows the whole range at once and has no scroll to work start.

The grid shows the Workdays. A day that is not a Workday also shows when it holds an Entry, Meeting or Absence. So no item is ever hidden. The Workdays come from the settings row that is valid on each day (ADR 0012).

We did not use a fixed 24 hour grid, because it is mostly empty and the work hours are small. We did not use a fixed range of work hours only, because an Entry outside it would be hidden. The range uses the current settings, not the history, because one grid has one set of hours.
