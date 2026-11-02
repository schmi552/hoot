# Hoot

A local desktop app that helps one person record what they do at work and shows it in a calendar.

## Language

**Category**:
A label the user assigns to time. It has a code (for example a PSP element number), a name and one of eight colors. In practice it is a PSP element, but the app calls it a category.
_Avoid_: PSP element, project, tag

**Entry**:
A block of time the user logged, with a description and a category.
_Avoid_: Worklog, task, event, log

**Meeting**:
A calendar item that comes from a recurring rule or an imported `.ics` file. It can have a category. It does not count as what the user did last.
_Avoid_: Event, appointment

**Absence**:
Time the user is away, such as sick days, vacation or a few hours off. It spans part of a day, one day or several days. It has a type: Vacation, Sick, Holiday or Other. It is not an Entry.
_Avoid_: Time off, leave

**Workday**:
A day of the week that the user has set as a day they work. Expected time is zero on a day that is not a Workday. The default is Monday to Friday.
_Avoid_: Weekday, working day

**Workday location**:
Home or office, one value per day.
_Avoid_: Work mode, place

**Gap**:
Time in the current workday that has no Entry and is not lunch, outside work hours, a Meeting or an Absence, and is longer than one popup interval plus a 5 minute margin.
_Avoid_: Hole, missed time
