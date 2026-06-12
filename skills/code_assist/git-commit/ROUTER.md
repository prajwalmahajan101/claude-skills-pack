---
name: code_assist/git-commit/ROUTER
description: Routes to git-commit plan (dry-run) or interactive (execute) sub-skill based on the user's request
type: router
---

# Git-Commit Router

Pick exactly one sub-skill and follow it. Do not duplicate its logic here.

## Routing Table

| Trigger phrases | Sub-skill file | Mode |
|---|---|---|
| "dry run", "dry-run", "plan it", "just plan", "show commands", "suggest commits", "preview commits", `--dry-run` | `plan.md` | Plan only |
| default — "commit", "stage and commit", "commit my changes", "atomic commits", "split commits" | `interactive.md` | Execute (interactive) |

## How to Use

1. Confirm you are inside a git repository (`git rev-parse --is-inside-work-tree`). If not, tell the user and stop.
2. Decide mode from the user's message using the table above. When ambiguous, default to **interactive**.
3. Read `/home/prjawal/.claude/skills/code_assist/git-commit/shared.md` for commit-message format and global rules.
4. Read the chosen sub-skill file (`plan.md` or `interactive.md`) and execute it exactly.

Both sub-skills inherit the rules in `shared.md`.

---

## Optional: Agent Dispatch for Plan Mode

For **plan mode only**, you may delegate to the `commit-planner` subagent instead of running `plan.md` inline. Useful when the working tree is large and you want diff output to stay out of the main session.

**When to delegate:**
- `git diff --stat | wc -l` returns > 50 file rows, **or**
- The user explicitly asks (e.g., `/code_assist:git_commit_plan` on a noisy repo).

**When NOT to delegate:**
- Small diffs (< 50 files) — agent overhead isn't worth it.
- `interactive` mode — never delegate; per-commit user confirmation must stay in the main session.

**How to delegate:**

Spawn the agent in a single Agent tool call:
- `subagent_type: commit-planner`
- `description`: e.g. `"Plan commits for current diff"`
- `prompt`: pass through any `scope_hint` (path filter, feature name). The agent does not need any other inputs.

When it returns the plan table + commands code block, hand it straight to the user without modification.

**Interactive mode never delegates** — `interactive.md` runs in the main session because each commit needs user confirm/skip/edit/reorder input.
