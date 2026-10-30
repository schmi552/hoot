---
status: accepted
---
# A Meeting series can have no Category and keeps its source file name

An `.ics` import can come without a Category, so `meeting_series.category_id` is now optional. SQLite cannot drop NOT NULL, so migration 7 rebuilds the table. Foreign keys are on, and dropping the old table deletes its exceptions. The migration therefore copies `meeting_exception` first and puts the rows back. The table also gets `source_file`, the name of the imported file. `source_file` is empty for an old import and NULL for a Meeting made by hand. The UI shows "from <file>", or "from .ics file" when the name is empty.

The Absence type from ADR 0013 is stored in a column named `kind`, not `type`. `type` is a reserved word in Rust and TypeScript. The user interface still says "Type".

We did not add a placeholder Category for imports, because it would show in the Category list and the export. We did not drop the older `source` column, because it stays correct with `source_file` (`ics` when a file name is set).
