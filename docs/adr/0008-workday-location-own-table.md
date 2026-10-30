# Workday location has its own table, and no row means not asked

The Workday location is one value per day, `home` or `office`. It is stored in the `workday_location` table, with the date as the primary key and a CHECK on the two values. The date is a local day in the zone of the settings, as "YYYY-MM-DD".

A day with no row has not been answered. The first popup of a day asks the question only when the day has no row. We did not add a "not asked" value, because the missing row already says it. We did not store the location on the Entry, because a day without Entries still has a location. We did not use `app_setting`, because it has no history per day.

A skipped popup writes no row, so the next popup asks again. The date is fixed when the popup opens, so an answer given after midnight or after a zone change is saved under the earlier date.
