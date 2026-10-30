# One Meeting occurrence changes through an exception keyed by its original start

A change to one occurrence of a recurring Meeting is a row in `meeting_exception`. The row belongs to the series and is keyed by `original_start_local`, the wall-clock start the rule gave the occurrence. `kind` is `skip` or `override`. An override holds the new start, length, title and Category. A field that is null keeps the value of the series.

TypeScript applies the exceptions when it expands the series (see ADR-0002). A skip removes the occurrence. An override replaces its fields. A later change of the same occurrence replaces the earlier row. We key by wall-clock time and not by UTC, so the key stays the same across a DST change (see ADR-0003). We did not copy the occurrence into an Entry or a new series, because the series would then lose its link to the occurrence.

An override can move an occurrence into a week that the rule did not give it. So when a series has an exception, the expansion reads the rule from 14 days before to 14 days after the visible range (`OVERRIDE_REACH`). An override that moves an occurrence by more than 14 days does not show in the range it moves to. We accept this limit, because a Meeting that moves that far is rare.

"All Meetings" changes the series. A new start time of the series makes the old keys useless, so `update_meeting` deletes the exceptions of that series. A change of title, Category or length keeps them. There is no "this and following" option.
