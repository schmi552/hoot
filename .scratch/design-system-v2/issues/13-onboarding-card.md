# 13: Onboarding card

**What to build:** A new user sees a four-step onboarding card that matches the onboarding board: work time, lunch, Categories, check-in interval. The card has a Mon to Sun picker for "When do you usually work?", and chips for lunch (30, 45, 60 minutes) and for the interval (15, 30, 45, 60). The defaults are 07:00 to 16:00, lunch 12:00 plus 30 minutes, interval 30, Monday to Friday. Each Category row needs a code. The name can be empty and then equals the code. A row with two empty fields is ignored. A duplicate code shows an error under the row and stops the save. "Start tracking" is disabled until the form is valid. Field errors use the input error style. The fields that Onboarding and Settings share are built as shared components, so ticket 14 can use them. Hoot shows at pixel size 5 px. Ticket 16 may later replace the sprite with the final one.

Spec stories: 49 to 57.

**Blocked by:** 08, 09, 11

**Status:** done

- [ ] The card matches the onboarding board in light and dark.
- [ ] Vitest tests cover the form checks: duplicate code, the ignored empty row, an empty name.
- [ ] "Start tracking" is disabled for an invalid form and saves a valid form with the chosen Workdays.
- [ ] The saved Categories get code, name and color by the color rule.
