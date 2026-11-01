---
status: accepted
supersedes: 0007
---
# The user sets which days are workdays

Design system v2 asks "When do you usually work?" in onboarding, with a Monday to Sunday picker. We add a workday setting in a new `settings_history` column, with the default Monday to Friday, so a save starts today and earlier weeks keep their old expected time. Expected time is zero on a day that is not a Workday. The check-in popup and Gap detection skip that day, and the user can still add Entries to it. We did not drop the picker, because the user cannot work on other days without it. ADR 0007 said a later ticket must add this setting.
