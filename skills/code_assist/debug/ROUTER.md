---
name: code_assist/debug/ROUTER
description: Routes debugging to a fresh investigation or resuming an existing debug session. Enforces the Iron Law - no fix without a reproduced root cause.
type: router
---

# Debug Router

Load `_shared/discipline.md` (Iron Law #1: no fix without root cause). Read
`.code_assist/STATE.md`.

| Situation | Load | Command |
|---|---|---|
| New bug / failure / unexpected behavior | `investigate.md` | `/code_assist:debug` |
| A `.code_assist/.debug/DEBUG.md` session exists, continue it | `resume.md` | `/code_assist:debug_resume` |

If `.code_assist/.debug/DEBUG.md` exists and is unresolved, prefer `resume.md`.

## Persistence
Every session writes a scientific-method log to `.code_assist/.debug/DEBUG.md` so it
survives context resets. On root cause found, hand off to `test` (write the regression
test) → fix → `verify` → `commit` (type `fix`).

## Execution Mode - Agent Dispatch
Delegate a full investigation to the **`ca-debugger`** subagent
(`subagent_type: ca-debugger`, pass `repo` + `symptom`, or `resume: true`). It keeps DEBUG.md
current and returns the root cause + regression test + fix. Small/obvious repros: run inline.
The Iron Law (no fix without a reproduced root cause) applies either way.
