---
name: code_assist/refactor/ROUTER
description: Refactor safely - restructure for clarity/consistency without changing behavior, under a green test suite. Includes dead-code cleanup and simplification. Flexible family.
type: router
---

# Refactor

Restructure code without changing behavior. The safety net is a green test suite - if there
isn't one for the code being changed, add characterization tests first (hand to `test`).

## Steps (one todo each)
1. **Establish the net** - run the existing tests green. If coverage is thin around the target,
   add characterization tests capturing current behavior first.
2. **Scope** - one refactor per pass (extract, rename, de-duplicate, simplify a conditional,
   remove dead code). Use `graph impact <symbol>` to see blast radius before moving something.
3. **Refactor in small steps**, running tests after each. Behavior must not change.
4. **Simplify, don't rewrite** - prefer the minimal change that improves clarity/consistency;
   match surrounding style; do not introduce a new abstraction unless it removes real duplication.
5. **Verify** the suite is still green (hand to `verify`); commit as `refactor:` (no behavior
   change) - never mixed with a feature or fix.

## Dead-code cleanup
Identify with the tooling the repo has (knip/ts-prune/depcheck, `go vet`, ruff, etc.) and the
code graph (`graph impact` to confirm nothing references it). Remove in a dedicated `refactor:`
or `chore:` commit; when unsure whether something is truly unused, flag it rather than delete.

## Rules
- No behavior change. If behavior must change, that's a `feat`/`fix`, not a refactor.
- Small, test-backed steps. Commit refactors separately from feature work.
