---
name: code_assist/orchestrator/ROUTER
description: Cross-family orchestrator - runs curated multi-step chains (flow ship / flow start / flow fix) that thread review, commit, journal, track, notify, plan, structure together. Invoked by /code_assist:flow.
type: router
---

# Orchestrator - Cross-Family Flows

Runs a named chain of families in order, passing artifacts forward. Each step is a normal
family; the orchestrator only sequences them, gates on the discipline layer, and keeps
`.code_assist/STATE.md` current. It never re-implements a family's logic.

Load `_shared/discipline.md` + `_shared/state.md` first. Read `STATE.md` before starting.

## Usage

```
/code_assist:flow <chain> [args]
```

## Chains

### `ship` - take reviewed work to a shipped, tracked, announced commit
1. `review` (auto-detect stack) → fix loop until issues resolved or deferred.
2. `verify` → fresh evidence the change works (run tests/app).
3. `commit` (interactive) → atomic Conventional Commits, no AI footer.
4. `journal` update → reference the new SHAs.
5. `track transition` → move the linked ticket (dry-run + confirm).
6. `notify` → post a summary to slack/telegram (confirm before send).
Stop early and report if review issues remain unresolved and undeferred.

### `start` - spin up work from a ticket / idea
1. `track get <KEY>` (if tracker configured) → pull the issue as context.
2. `plan brainstorm` → `plan write` → get approval (HARD-GATE).
3. `structure scaffold` (new project/module) → `onboard` seed CLAUDE.md if missing.
4. Write `.code_assist/.continue-here.md` with the first execution command.

### `fix` - disciplined bug fix
1. `debug investigate` → reproduce + root cause (Iron Law: no fix first).
2. `test` → write the failing regression test.
3. implement the fix → `verify`.
4. `commit` (type `fix`) → `journal` update.

### `land` - pre-PR gate
1. `structure audit` → no new structural regressions.
2. `scan sonar` (if configured) + `review` targeted on the diff.
3. `verify` → `commit` remaining → optionally `github pr`.

## Rules
- Every chain step is a REQUIRED transition from `_shared/discipline.md` - do not skip a
  step silently; if one is not applicable, say so and continue.
- External writes (track/notify/github) stay dry-run + confirm.
- Update `STATE.md`'s "Now" + "Open threads" after each step so a reset can resume.
- If any step fails, halt the chain, record where in `.continue-here.md`, and report.
