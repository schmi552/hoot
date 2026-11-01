# 15: Settings: Categories, Recurring Meetings and Backups

**What to build:** The three other Settings sections work as the settings board shows. Categories has a table with Color, Code, Name, month hours and a "Delete" or "Archive" action. "Add Category" adds a row with empty inputs. Enter saves and Esc cancels. Recurring Meetings lists the series with "N changed" and "from team.ics". A click on a series opens the same Meeting dialog as the calendar. "Add Meeting" and "Import .ics …" are available. Backups shows "Last backup" with the date and time of the newest backup file, "Open folder", and "Restore …". Restore opens a confirm dialog that names the newest copy and says that the app restarts. These sections act at once, with no Save. ADR 0005 gets a note that restore is also in Settings.

Spec stories: 65 to 69, 72 to 74.

**Blocked by:** 09, 10, 14

**Status:** done

- [x] The row action label is "Delete" for an unused Category and "Archive" for a used one, and the action does what the label says.
- [x] Enter saves and Esc cancels a new Category row. A duplicate code shows the input error style.
- [x] The Meeting list shows the changed count and the source file name.
- [x] "Last backup" shows the newest backup file time. "Open folder" opens the backups folder.
- [x] The restore confirm dialog names the newest copy.
- [x] The sections match the settings board in light and dark.
