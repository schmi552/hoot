# One Absence table holds a full-day shape and a part-day shape

An Absence is a row in the `absence` table. A full-day Absence has `start_date` and `end_date`, local dates with both days included. A part-day Absence has `start_utc`, `end_utc` and `tz` (see ADR-0003). A CHECK constraint allows only these two shapes. A row that mixes them, or that ends before it starts, is refused by the database.

We did not use two tables, because the calendar, the popup and the expected time read both kinds as one list. We did not store full-day Absences as UTC instants, because "vacation Monday to Friday" would move when the zone of the laptop changes.

TypeScript turns each row into a span (`absenceSpans`). A full-day Absence covers whole days in the zone of the settings, so a DST day has the right length. The popup, the Gap and the expected time (`expectedOn`) cut these spans out in the same way as Meetings. A weekend day keeps zero expected time (see ADR-0007).

The code shows the two shapes as nullable fields and not as a union type. The CHECK constraint holds the rule. A part-day Absence stores `tz`, but nothing reads it yet: spans use the stored instants. A full-day Absence has no zone, so a change of the zone in the settings moves the instants of the days, not the days.
