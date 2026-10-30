# 10: Absence type and Meeting series source file

**What to build:** An Absence has a type: Vacation, Sick, Holiday or Other. An old label that equals `vacation`, `sick` or `holiday` (exact, ignoring case) becomes that type with an empty label. Any other label becomes `Other` and keeps the label. A full-day Absence shows the type first and then the label if set. A part-day Absence shows the label if set, and the type if not. The Absence form has a type select. A Meeting series can have no Category, so an `.ics` import can come without one (check first if the table requires a Category, and make it optional if it does). An imported Meeting series remembers its source file name. Old imported series show "from .ics file".

Spec stories: 22 to 24, 32.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Cargo tests cover the type migration: each known label, a different case, an unknown label (Other, label kept).
- [ ] The database refuses an Absence type that is not one of the four.
- [ ] A Meeting series can be saved and read with no Category.
- [ ] An `.ics` import stores the source file name, and old series get the fallback text.
- [ ] The Absence form has a type select, and the calendar shows the display rule for full-day and part-day Absences.
