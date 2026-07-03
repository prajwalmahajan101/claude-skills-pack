---
name: code_assist/plan/shared
description: Shared planning conventions - plan file location, structure, task sizing, and the approval gate. Included by brainstorm/write/execute.
type: shared
---

# Plan - Shared Conventions

## Where plans live
`.code_assist/.plan/<slug>.md`. One file per initiative. Keep it the source of truth for
that work; update it as scope changes rather than spawning parallel plans.

## Plan file structure
```markdown
# <title>

## Context
Why this exists — the problem, what prompted it, the intended outcome.

## Approach
The chosen approach (only the recommended one, not every alternative).

## Tasks
- [ ] T1 — <one bite-sized, independently verifiable step> (files: …)
- [ ] T2 — …

## Verification
How to prove it works end-to-end (commands to run, tests, manual checks).

## Risks / open questions
```

## Task sizing (from superpowers writing-plans)
Right-size each task to **one implement + test + review cycle**. A task should be
completable and verifiable on its own, name the files it touches, and not require holding
the whole design in mind. Split anything bigger.

## The approval gate
The plan is a HARD-GATE. Do not write design-dependent code until the user approves the
written plan. Record approval in the plan file (a one-line "Approved <date>" note) so a
later session knows execution may proceed.

## Grounding
Use `node bin/ca-tools.js stack-detect` and `structure-audit` to ground the plan in the
repo's real shape; `graph query "<concept>"` / `graph impact <symbol>` to scope blast
radius before proposing changes.
