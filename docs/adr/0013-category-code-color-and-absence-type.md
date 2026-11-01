---
status: accepted
---
# A Category has a code and a color; an Absence has a type

Design system v2 shows every Category as a code, a name and one of eight colors. The `category` table gets `code` (UNIQUE when not empty) and `color` (1 to 8). The migration splits an old name such as "PSP-1042 Platform migration" at the first space when the first token has a digit. Old Categories get colors 1 to 8 in `id` order. A new Category gets the next free color; when all eight are used, it gets the least used color. An archived Category keeps its color, so old weeks do not change, but its color counts as free for "next free". The `absence` table gets `type` (Vacation, Sick, Holiday, Other) with a CHECK, and `label` becomes optional detail text. The migration maps an old label that matches a type exactly (ignoring case) and gives every other label the type `Other`.

We did not parse the code out of `name` at read time, because the rule would live in every place that shows a Category, and the export needs the code as its own column. We did not keep the free Absence label as the only field, because the boards show the type first and the color and hatch rules depend on it. The decision keeps ADR 0001 (all SQL in Rust) and ADR 0010 (one Absence table, two shapes).

A Category with no Entries and no Meetings is still deleted and not archived. The check now includes Meeting series and exceptions.
