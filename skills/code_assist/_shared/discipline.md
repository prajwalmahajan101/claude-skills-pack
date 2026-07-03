---
name: code_assist/_shared/discipline
description: The discipline layer - Iron Laws, Red-Flags table, checklists-as-todos, and mandatory family-chaining. Baked in from superpowers so code_assist enforces process without depending on the superpowers plugin. Load at the start of every family.
type: shared
---

# code_assist - Discipline Layer

This is the behavioral backbone. It is **self-contained** (no dependency on the
superpowers plugin) and applies to every family. Process skills run *before*
implementation skills.

## Iron Laws (non-negotiable)

1. **No fix without a root cause.** (`debug`) Never patch a symptom before you have
   reproduced the failure and explained the mechanism. Wrote a fix on a hunch? Revert it
   and investigate first.
2. **No production code without a failing test first.** (`test` / TDD paths) Write the
   test, watch it fail, then make it pass. Wrote code first? Delete it and restart the loop.
3. **No completion claim without fresh verification.** (`verify`) "Done" requires evidence
   produced *in this turn* - a command you just ran, output you can quote. No "should work".
4. **No design-dependent code before the design is approved.** (`plan`) Non-trivial work
   goes through a written, approved plan first. A plan described in chat is not approval.
5. **No silent scope/skip.** If you drop coverage, cap a search, or can't satisfy a law,
   say so explicitly - never let an omission read as completeness.

## Red Flags - rationalizations that mean STOP

| Thought | Reality |
|---|---|
| "This is a trivial fix, skip the test/plan." | Trivial fixes still break things. Follow the law. |
| "I basically know the root cause." | Then you can prove it in 2 minutes. Prove it. |
| "It should work, I'll say done." | Run it. Quote the output. Then say done. |
| "I'll stage everything, it's all related." | Stage explicit paths; split logical changes. |
| "The user will approve as I go." | Get plan approval before design-dependent code. |
| "I'll note the caveat later." | Note it now, in the same message, or it's a silent skip. |

## Checklists as todos

When a family lists a checklist or ordered steps, create ONE todo per item and complete
them in order. Do not batch, skip, or reorder without saying why. The todo list is the
audit trail.

## Family chaining (REQUIRED transitions)

Some families hand off to others. Honor these:

- `plan` → (on approval) → `test`/implement → `verify` → `commit` → `journal`.
- `debug` → (root cause found) → `test` (regression test) → fix → `verify` → `commit`.
- `review` → (issues) → fix loop → `verify` → `commit`.
- New project / new module → `structure scaffold` → `onboard` (seed CLAUDE.md) → `adr` (first decisions).
- `commit` → `journal` (reference the new SHAs) → optional `track` (update the ticket) → `notify`.

The `orchestrator/ROUTER.md` encodes the multi-step chains (`flow ship`, `flow start`).

## Rigid vs flexible

- **Rigid** (follow exactly, no adapting away the discipline): `debug`, `test`, `verify`,
  the commit staging rules, the no-footer rule.
- **Flexible** (adapt the principle to context): `review` weightings, `plan` depth,
  `structure` scaffolding choices, domain playbooks.

## Grounding

Prefer the deterministic backbone for exact facts: `node bin/ca-tools.js <cmd>` for stack
detection, diff stats, structure audit, state I/O, code-intel (`graph impact` = blast
radius). The LLM judges; `ca-tools.js` computes.
