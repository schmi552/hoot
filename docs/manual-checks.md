# Manual checks

Do these checks on macOS and on Windows before a release.

## Tray
- [ ] The tray icon shows after the app starts.
- [ ] "Open" shows the main window. "Quit" ends the app.
- [ ] Close the main window. The app stays in the tray.

## Autostart
- [ ] Settings > "Start at login" is on. Log out and in. The app starts.
- [ ] Turn the switch off. Log out and in. The app does not start.

## Popup
- [ ] The popup shows on top of other apps when the interval ends.
- [ ] The popup stays on top when you click another app.
- [ ] macOS: there is no Dock icon while the app runs.

## Meetings
- [ ] Click a repeating Meeting, then "Delete Meeting". Choose "This Meeting only". Only that day goes.
- [ ] Click a repeating Meeting, then "Edit Meeting". Change the start. Choose "This Meeting only". Only that day moves.
- [ ] Do the same and choose "All Meetings". Every day changes.
- [ ] A one-off Meeting changes or goes without the dialog.
