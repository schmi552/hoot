# 17: Popup gap question

**What to build:** The popup asks about a **Gap** in the form of the popup board, with Hoot in the Away mood. It offers "Accept (A)", "Split (S)" and "Leave empty (L)", and each key resolves the Gap. "Split" asks for one time, "New from". The part before that time continues the last Entry, and one new part starts at that time. The user's choice appears as a bubble of their own (for example "Split it"), so the thread reads like a chat. The multi-part Split form, "Add part" and the "Previous" chip are removed.

Spec stories: 43 to 45.

**Blocked by:** 16

**Status:** ready-for-agent

- [x] The A, S and L keys resolve a Gap.
- [x] Split with one time gives two parts: the old Entry up to that time, and a new part from that time.
- [x] The user's choice shows as its own bubble.
- [x] No multi-part Split form, "Add part" or "Previous" code remains.
- [x] The Gap question matches the popup board in light and dark.
