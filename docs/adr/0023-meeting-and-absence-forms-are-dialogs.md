# Show the Meeting form and the Absence form as dialogs

Amends ADR 0021 for two forms. The boards stay the source of truth. The boards do not show these two forms, and the user decided to change them after seeing the app.

The Meeting form and the Absence form open as a modal dialog over a dimmed page. Before, they were rows above the calendar. A row got too wide for the Meeting form, which has six fields, and it wrapped badly in a narrow window. A modal also means that only one form can be open at a time.

Both forms use one component, `FormDialog` (`src/FormDialog.tsx`). It has a header with the title, a body for the labelled fields and the error line, and a footer with the Cancel and Save buttons. The Escape key closes it. The form fields are the children. It uses the existing `.wt-modal` style, the same as the Export and Import dialogs. The "This Meeting only / All Meetings" question stays a separate small dialog.

The Entry form stays a row above the calendar. A user adds Entries many times a day, and the selection outline on the grid must stay in view. A modal would hide the outline and add a click to each Entry.

Only one of the three forms (Entry, Meeting, Absence) is open at a time. Opening one closes the other two, and the text in the closed form is lost.

## One dialog for a new Meeting or Absence

The "+ New" menu has one row for both, "Meeting / Absence (M)". The dialog is titled "New Event" and has a switch in its header between Meeting and Absence. The keys M and A still open it on the matching kind. Switching kind clears what the user typed. Editing an existing Meeting or Absence shows no switch, because one kind cannot change into the other.

The data stays separate (ADR 0009, 0010 and 0015). Only the way to add an event is merged. We did not merge the Entry form into it, for the reasons above. We considered one dialog for all three kinds and rejected it for that reason.
