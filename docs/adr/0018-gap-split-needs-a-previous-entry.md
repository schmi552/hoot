---
status: accepted
---
# Split in the Gap question needs a previous Entry

The Gap question offers "Accept (A)", "Split (S)" and "Leave empty (L)". "Split" asks for one time, "New from". The part before that time continues the previous Entry, and one new part starts at that time. So Split shows only when a previous Entry exists, and the S key does nothing without one. Without a previous Entry the user has two choices: Accept the whole Gap as one Entry, or leave it empty. They can still split the Entry later in the calendar. We did not let Split make the part before its own Entry, because that needs a second form for a case that is rare: the first Gap ever, or a Gap after the 30 day history window.

If the previous Entry does not end where the Gap starts, or lunch cuts the part before into more than one span, the first span extends the previous Entry only when they touch. The other spans become new Entries with the description and Category of the previous Entry.
