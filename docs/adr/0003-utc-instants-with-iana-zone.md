# Store times as UTC instants with an IANA zone

Entries and part-day Absences store UTC epoch seconds and the IANA zone name that was active when the row was made. Recurring Meetings store a local wall-clock start and an IANA zone, so "10:00" stays 10:00 across DST changes. Full-day Absences store local dates, so "vacation Monday to Friday" does not move when the laptop zone changes. We did not choose plain local date-time with no zone, because a trip or zone change would move old rows.
