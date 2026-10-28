---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Use /ponytail for all code you write. The spec and tickets decide what
gets built; ponytail decides how little code it takes.

Use /tdd where possible, at pre-agreed seams. Where tdd and ponytail
disagree on tests, tdd wins at agreed seams; outside them, follow
ponytail's rule.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.
