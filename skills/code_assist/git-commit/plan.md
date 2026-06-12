---
name: code_assist/git-commit/plan
description: Dry-run commit plan generator — analyzes diffs and outputs paste-able git commands without staging or committing
type: subskill
---

# Git-Commit — Plan (Dry-Run)

Generate an atomic commit plan and the corresponding `git` commands. **Never stage, never commit.** Stop after output.

Inherits format and rules from `shared.md`.

---

## Step 1: Analyze Changes

Run these in parallel:

```bash
git status
git diff --stat
git diff --cached --stat
```

Then read specific files with `git diff -- <file>` as needed to make grouping decisions. Do not load full diffs of large repos at once.

If there are no staged or unstaged changes, tell the user *"No changes to commit."* and stop.

---

## Step 2: Present the Commit Plan

Render the planned commit sequence as this table:

| # | Type | Summary (≤72 chars) | Files | Why |
|---|---|---|---|---|
| 1 | feat | add user registration endpoint | src/routes/register.ts, src/handlers/register.ts | enables self-service signup |
| 2 | test | cover registration handler edge cases | test/register.test.ts | guard against regressions |
| … | … | … | … | … |

---

## Step 3: Emit Paste-able Commands

Below the table, emit one stacked code block using the compact dual-`-m` form (one body paragraph per commit):

```bash
git add src/routes/register.ts src/handlers/register.ts
git commit -m "feat: add user registration endpoint" -m "Introduces a new registration endpoint, validates input, and stores users securely."

git add test/register.test.ts
git commit -m "test: cover registration handler edge cases" -m "Adds tests for malformed input, duplicate emails, and rate limiting."
```

Stack all commits in execution order inside a single code block.

---

## Stop Here

Do **not** run `git add` or `git commit`. The user runs the commands themselves. If they want execution, point them at `/code_assist:git_commit` (interactive mode is the default).
