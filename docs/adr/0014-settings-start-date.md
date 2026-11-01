---
status: accepted
---
# A new work schedule starts on a date the user chooses

The Settings board shows a "From" date for a new work schedule. `save_settings` took only today, so a save always started today. It now takes a start date. The date cannot be in the past and defaults to the next Monday. All Work time fields (hours, lunch, workdays, check-in interval) share the one date. Days before the date keep the old values. The date itself and later days use the new ones, also in the middle of a week. When Expected per day does not change, the date field is hidden and the start is today. We did not give each field its own date, because one history row per date keeps `settings_history` simple. We did not allow past dates, because that would change weeks the user already closed.
