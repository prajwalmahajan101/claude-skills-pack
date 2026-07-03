---
name: code_assist/test/ROUTER
description: Test-driven development gate - write the failing test first, then the code. Also the home for adding regression tests (from debug) and filling coverage gaps. Rigid family.
type: router
---

# Test (TDD)

Iron Law #2: **no production code without a failing test first.** Rigid - do not adapt the
discipline away.

## The loop (one todo per cycle)
1. **Red** - write the smallest test that captures the desired behavior; run it; watch it
   fail for the right reason. If it passes immediately, the test is wrong.
2. **Green** - write the minimum code to make it pass; run the test; confirm green.
3. **Refactor** - clean up code and test with the suite green (hand to `refactor` if large).
4. Repeat for the next behavior.

## Uses
- New behavior: drive it out test-first.
- Regression test from `debug`: the failing test that proves the root cause, before the fix.
- Coverage gap: add behavioral tests (prefer integration/e2e over heavily-mocked units;
  do not chase coverage numbers - test behavior and real bug-prevention).

## Rules
- Wrote production code before its test? Delete it and restart the cycle.
- Tests assert behavior and observable outcomes, not implementation details.
- Run the full suite before declaring done (hand to `verify`).
- Match the repo's test layout (`tests/{unit,integration,e2e}` or the language convention).
