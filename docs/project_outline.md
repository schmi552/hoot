# Hoot
Issue is that i want to keep better track of what i do at work. However excel is tedious and i dont want to write to a md etc.

## Proposal
Small application in tauri (just want to try tauri and its lightweight) that spins up when i log into my pc/mac etc. I want it to have a lightweigt db, everything stays on the users machine. The application shall have a calendar that visualizes the contents of the database

### Onboarding
When opening the application initially, we need following infos: usual work hours (e.g. from 7 til 16.00), when you usually take a lunch break and optinally different categories (i want to call them categores, in practice they are psp elements). Then you should be able to set an iterval. 

### Usage
In said interval, we have a small popup that has a textfield and a dropdown for the categories where a user can enter what he is doing and assign it a category. those entries then get added to the calendar. There should also a field that says in the last x hours, you worked on that, are you still doing that and a button to confirm so that the user does not have to re enter stuff over and over again. In the first popup of the day the user shall also be added if he works from home or in the office and that shall be reflected in the calendar.

#### UI
Apart from the popup, the app shall have a proper ui. The calendar shall have a week and a month view. It shall be also possible to add absences (like sick days or vacations) that span one day, mustiple days or just a few hours a day. by clicking in the calendar the user shall also be able to create worklog entries. calendar shall support drag and drop for entires and resizing events so that they span more hours. also copy pasting, duplicating and deletion shall be supported via hotkeys. Also reports shall be exportable as excels. User shall be able to set a timeframe and then every entry out of that timeframe gets exported. Via the ui, the user shall also be able to add recurring events and add them to a category so that recusrring meetings are added automatically. note that if a meeting happens, that does not count as what the user did last, so keep that in mind for the popup. We also need to be able to import .ics files. When importing we add those to the calendar and can assign them a category. If possible/viable, if those ics files contain recurring events, this shall be doable as well. single events out of an recursion shall be deletable/modifyable without affecting the whole occasion. Now that i am thinking about it, we basically need to support everything the usual calendars (apple calendar, google calendar etc) support. 


### Ux
straght forward as simple as possible. tracking shall be as easy and intuitive as possible. 

### ui
i would like to have som fon, pixelated mascot like clippy or the claude crab that appears in the popup/ui. other than that i am open.