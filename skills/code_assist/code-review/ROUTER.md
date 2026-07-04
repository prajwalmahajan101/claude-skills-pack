---
name: code_assist/code-review/ROUTER
description: Routes to backend, frontend, tui, or fullstack code review based on stack detection
type: router
---

# Code-Review Router

Pick the right variant(s) and load them. Do not duplicate review logic here.

## Optional pre-pass (static analysis + blast radius)

Before scoring, when configured, gather deterministic signal to fold into Step 3's detection
checklist (treat security findings as blocking, style as informational):

- `node bin/ca-tools.js scan sonar` - SonarQube open issues (needs `SONAR_*` env; no-op otherwise).
- `node bin/ca-tools.js graph detect-changes` / `graph impact <symbol>` - map the diff to
  affected symbols/flows and size blast radius (needs gitnexus; skip if absent).
- `node bin/ca-tools.js recall --context "<changed area / feature>" --kinds risks,lessons` -
  known **risks** and past lessons for this area; check the diff against each risk `ref` (a
  previously-recorded regression is a prime thing to re-flag).

These are inputs, not a replacement for the architectural review.

## Step 0: Targeted Review Shortcut

If the user's message contains any of: "review my changes", "review this PR", "review the pr", "review last commit", "review staged", "review diff" → **skip stack detection entirely**. Load only `shared.md` and follow the *Targeted Review* path. No weighting, no living docs.

## Step 1: Detect Stack

Read and execute `/home/prjawal/.claude/skills/code_assist/code-review/detect.md`. It returns one of:

- `backend`
- `frontend`
- `tui`
- `fullstack:<comma-list>` (e.g. `fullstack:backend,frontend`)
- `unknown`

## Step 2: Load Variant(s)

| Detection result | Action |
|---|---|
| `backend` | Load `shared.md` + `backend.md` |
| `frontend` | Load `shared.md` + `frontend.md` |
| `tui` | Load `shared.md` + `tui.md` |
| `fullstack:<list>` | For each stack in the list, run a full review in parallel (each writes to `.code_review/<stack>/`). Then regenerate top-level `.code_review/SUMMARY.md` with per-stack maturity + overall scores. |
| `unknown` | Warn the user, fall back to `backend.md` |

## Step 3: Execute

Follow `shared.md` Steps 1-6 using the weight table from the loaded variant file. Anti-patterns from the variant are added to Step 3's detection checklist.

## Execution Mode - Agent Dispatch

Full reviews (single or fullstack) are delegated to the **`architectural-reviewer` subagent** to keep main-context clean and enable parallelism. Targeted reviews and `detect.md` continue to run inline - no agent needed for those.

### Single-stack full review

1. Spawn one `architectural-reviewer` agent in a single Agent tool call:
   - `subagent_type: architectural-reviewer`
   - `description`: e.g. `"Backend code review"`
   - `prompt`: must include `stack=<detected>` and `state_dir=.code_review/` (flat layout). Pass through any `scope_hint` the user supplied.
2. When the agent returns its ≤30-line confirmation, present it to the user.
3. **In the main session**, read `.code_review/code_review_issues.md` and run Step 6 from `shared.md` (FIX/DEFER/CANCEL loop). The agent does not run Step 6.

### Fullstack full review

1. Spawn **one `architectural-reviewer` agent per detected stack, all in a single message** (parallel execution). Each agent gets:
   - `stack=<one>`
   - `state_dir=.code_review/<stack>/`
2. When all agents return, write `.code_review/SUMMARY.md` yourself (see template below).
3. **In the main session**, ask the user which stack's issues to address first, then run Step 6 against the chosen `state_dir`'s `code_review_issues.md`.

### When to skip the agent

- **Targeted review** (Step 0 shortcut) - run `shared.md`'s targeted-review path inline. The diff is small; agent overhead isn't worth it.
- **Stack detection** (`detect.md`) - run inline. Returns one token.
- **Per-variant slash commands** (`/code_assist:code_review_backend`, `_frontend`, `_tui`) - these are user-explicit shortcuts; you may still delegate to the agent, but inline is fine for small repos.

---

## Fullstack Behavior

When `detect.md` returns multiple stacks:

1. Tell the user which stacks were detected and that you'll review each in parallel.
2. For each stack, run an independent review writing to `.code_review/<stack>/{code_review_issues,code_review_history,learning,architecture_map}.md`.
3. After all stack reviews finish, write `.code_review/SUMMARY.md`:

```markdown
# Code Review — Multi-Stack Summary

_Last reviewed: YYYY-MM-DD_

| Stack | Maturity | Overall | Open Issues | Path |
|---|---|---|---|---|
| backend | XX | X.XX | N | .code_review/backend/ |
| frontend | XX | X.XX | N | .code_review/frontend/ |
| tui | XX | X.XX | N | .code_review/tui/ |
```

Single-stack repos keep the flat `.code_review/*.md` layout (no nesting) for backwards compatibility.

> **Note:** review state persists under `.code_review/` - recommend committing it so it survives across contributors.
