# Work Tracker

A local desktop app that helps one person record what they do at work and shows it in a calendar.

## Language

**Category**:
A label the user assigns to time. In practice it is a PSP element, but the app calls it a category.
_Avoid_: PSP element, project, tag

**Entry**:
A block of time the user logged, with a description and a category.
_Avoid_: Worklog, task, event, log

**Meeting**:
A calendar item that comes from a recurring rule or an imported `.ics` file. It has a category but does not count as what the user did last.
_Avoid_: Event, appointment

**Absence**:
Time the user is away, such as sick days, vacation or a few hours off. It spans part of a day, one day or several days. It is not an Entry.
_Avoid_: Time off, leave

**Workday location**:
Home or office, one value per day.
_Avoid_: Work mode, place
