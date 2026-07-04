---
name: code_assist/plan/ROUTER
description: Routes planning work to brainstorm, write, or execute. The HARD-GATE - design-dependent code needs an approved written plan first.
type: router
---

# Plan Router

Load `_shared/discipline.md` first (Iron Law #4: no design-dependent code before an
approved plan). Read `.code_assist/STATE.md`.

## Pick the phase

| Situation | Load | Command |
|---|---|---|
| Fuzzy idea, requirements unclear, multiple approaches | `brainstorm.md` | `/code_assist:plan` |
| Requirements clear, need a written, reviewable plan | `write.md` | `/code_assist:plan_write` |
| An approved plan exists, execute it task-by-task | `execute.md` | `/code_assist:plan_execute` |

Default `/code_assist:plan` with no clear design → start at `brainstorm.md`, then flow
into `write.md`. Never skip straight to code.

## The gate

`brainstorm` → `write` → **approval** → `execute`. Plans are saved under
`.code_assist/.plan/<slug>.md`. Execution does not begin until the user approves the
written plan. A plan described only in chat is not approval.

## Execution Mode - Agent Dispatch
For a larger initiative, delegate the `write` phase to the **`ca-planner`** subagent
(`subagent_type: ca-planner`, pass `repo` + `direction`) so plan authoring stays out of the
main context. It writes `.code_assist/.plan/<slug>.md` and stops at the approval gate. Small
tasks: run inline. Never let the agent begin execution - approval stays with the user.

## Handoff
After execution: `verify` (Iron Law #3) → `commit` → `journal`. See
`_shared/discipline.md` family-chaining.

> **Bridge:** `plan execute` honors `unabridged` (no truncation) when installed; a resolved plan can emit an `/sb:lesson`. See `bridge/ROUTER.md`.
