---
name: code_assist/verify/ROUTER
description: Goal-backward verification-before-completion. Produces fresh evidence - run this turn - that the change actually does what it was supposed to, before any "done" claim.
type: router
---

# Verify

Load `_shared/discipline.md` (Iron Law #3: no completion claim without fresh verification).
Single-purpose family - no sub-variants.

## What "verified" means
Evidence produced **in this turn**: a command you just ran, output you can quote, a test
that passed, the app behaving correctly. Not "it should work", not a prior run, not
"the code looks right".

## Steps (one todo each)
1. **State the goal** - what the change was supposed to achieve (from the plan / issue /
   bug). Verification is goal-backward: prove the GOAL is met, not just that tasks ran.
2. **Choose evidence** per goal facet: unit/integration tests, a real run of the app/CLI,
   `curl` against the endpoint, a DB query, `ca-tools graph detect-changes` for blast radius.
3. **Run it now** - actually execute. Capture the real output.
4. **Compare to the goal** - does the evidence show the goal met? Note any facet still
   unproven. Partial success is reported as partial, never rounded up to done.
5. **Report** - quote the evidence. If everything passes, state completion plainly. If not,
   list what failed with the output and route back to `debug` or `plan`.

## Rules
- Never claim done on unrun code. If you cannot run it, say exactly why and what remains.
- Re-run the project's full test + lint + type check if the change is non-trivial.
- Prefer end-to-end/integration evidence over asserting from reading the diff.
