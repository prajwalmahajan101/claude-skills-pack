---
name: code_assist/plan/execute
description: Execute an approved plan task-by-task with atomic commits, deviation handling, and verification. Optionally delegates independent tasks to fresh subagents.
type: skill
---

# Plan - Execute

Precondition: an **approved** plan exists at `.code_assist/.plan/<slug>.md`. If not, stop
and route to `write.md`.

## Steps
1. **Load & critically review** the plan. If a task is now wrong or underspecified, flag it
   and update the plan before executing - do not blindly follow a stale step.
2. **Create one todo per task**; execute in dependency order.
3. **Per task**: implement → run the task's verification → if it passes, make one atomic
   commit (`_shared/conventions.md`). Keep `.code_assist/STATE.md` "Now" current.
4. **Deviations**: if reality diverges from the plan, record the deviation in the plan file
   and continue with the corrected step; never silently drop a task.
5. **Independent tasks** (mechanical, scoped, well-specified): may be delegated to a fresh
   subagent so the orchestrator context stays lean (GSD-style). Re-read changed files and
   run lint/tests before marking done. Never delegate secrets/auth/payment/migration tasks.
6. **After all tasks**: run the plan's end-to-end Verification section (Iron Law #3) → hand
   off to `verify` → `commit` any remainder → `journal`.

## Rules
- Atomic commits, feature branch only, no AI footer.
- If blocked, write `.code_assist/.continue-here.md` (status + exact next command) and report.
- Run lint + type check + tests before considering a task done, if the project defines them.
