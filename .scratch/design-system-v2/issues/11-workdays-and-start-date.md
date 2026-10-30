# 11: Workdays and settings start date

**What to build:** The user chooses which days are **Workdays** (ADR 0012). The settings history gets a Workdays column, and existing rows get Monday to Friday. `save_settings` takes a start date (ADR 0014). The date must not be in the past. All Work time fields (hours, lunch as `lunch_start` and `lunch_end`, Workdays, interval) share it. A day before the start date keeps the old values. The start date itself uses the new values, also in the middle of a week. When Expected per day does not change, the start date is today and the date field is hidden. The schedule functions for expected time and the popup spans stop using the fixed Saturday and Sunday rule. They read the Workdays of the settings row that is valid on that day. The popup does not ask on a day that is not a Workday.

Spec stories: 25 to 31, 48.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Cargo tests cover `save_settings`: a past date is refused, a mid-week start. The unchanged Expected per day rule is in the form, so Vitest covers it (`needsStartDate`). The form also shows the date for a Workday change (ADR 0016).
- [x] Cargo tests cover the Workdays default migration.
- [x] Vitest tests cover `expectedOn` and the popup spans with Workdays, before and after a start date.
- [x] On a day that is not a Workday, expected time is zero and the popup does not ask.
- [x] Past weeks keep their totals after a Workday change.
