# 09: Category code, color and delete or archive

**What to build:** A Category has a code, a name and one of eight colors. Old Categories are migrated: the name splits at the first space when the first token has a digit, and old Categories get colors 1 to 8 in `id` order, wrapping after 8. A new Category gets the next free color among non-archived Categories. When all eight colors are used, it gets the least used color (count of Entries and Meetings, a tie goes to the lowest number). An archived Category keeps its color. The user can choose any color. The code is unique when it is not empty. A Category that nothing uses is deleted. A Category that something uses is archived. "Something" includes Meeting series and their exceptions. The existing Category UI shows the code and the color and lets the user set them. All SQL stays in Rust (ADR 0001).

Spec stories: 13 to 21.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Cargo tests cover the migration with old data in and new data out (code split, color order and wrap).
- [ ] Cargo tests cover the color rule: next free, the ninth Category, an archived color kept, a tie.
- [ ] Cargo tests cover a duplicate code (refused) and several empty codes (allowed).
- [ ] Cargo tests cover delete or archive, including a Category used only by a Meeting series or an exception.
- [ ] The user can see and change code and color in the current Category UI.
