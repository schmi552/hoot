# 30: Date and time picker in the Entry form

**What to build:** The Entry form had a fixed time. Add a start and an end date-time picker. A new Entry from the "+ New" menu, the Add Entry button or the `N` key starts now and ends 30 minutes later. A drag on the grid fills the pickers with the dragged range. Editing an Entry shows the same pickers.

**Blocked by:** none

**Status:** done

- [x] The form has a Start and an End `datetime-local` input. The day can change too.
- [x] A new Entry from the button or `N` is prefilled with the current time (cut to the minute) and 30 minutes more. A picked slot on the grid keeps its time and a length of 1 hour.
- [x] A drag on the grid fills the pickers with the dragged range.
- [x] An end that is not after the start shows an error and saves nothing.
- [x] Editing an Entry shows its times in the zone of the Entry. A change that overlaps another Entry is refused. The change is in the undo history.
- [x] An empty week shows an "Add Entry" button in its message. The selection outline stays on the grid while the form is open.
