# 23: Dialogs and import

**What to build:** The dialogs for Entry, Meeting and Absence have the same style: a Category combobox that shows "code name" with a color dot, and the buttons Cancel then Save. The Absence dialog has a type select. The series dialog is modal for move, edit and delete. It names the verb in its title and takes A, T and Esc. A repeat rule shows as text. A rule that the app cannot describe shows "This Meeting repeats." After an `.ics` import there is a Category step. If the user skips it, a notice with a "Pick Category" button sets one Category for all imported Meetings in one click.

Spec stories: 105 to 111.

**Blocked by:** 09, 10, 22

**Status:** done

- [x] Vitest tests cover the repeat-rule text, including the fallback.
- [x] The three forms look and behave the same.
- [x] A series dialog for move, edit and delete is modal and answers A, T and Esc.
- [x] After an import without a Category, "Pick Category" sets the Category on all imported Meetings.
- [x] The dialogs match the boards in light and dark.
