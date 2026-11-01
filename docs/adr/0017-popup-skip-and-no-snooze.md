---
status: accepted
---
# Esc skips the popup and the next tick asks again

The popup board has no Snooze chip, so we removed it. Before, Esc and Snooze both set the time of the last prompt, and the next popup came one check-in interval later (Snooze: 5 minutes). Now Esc closes the popup and does not set that time. The next tick asks again, as long as a popup is still due. A save or an answer still sets it. We did not keep a short delay after Esc, because the board shows only "Esc skip" and one rule is easier to explain. The cost is that a user who skips can see the popup again at the next tick. Closing with the window button is not changed and still delays the next popup.
