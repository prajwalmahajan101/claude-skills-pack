---
name: code_assist/git-commit/interactive
description: Interactive atomic commit executor — per-commit confirm/skip/edit/reorder with safe file-level staging
type: subskill
---

# Git-Commit — Interactive (Execute)

Plan atomic commits and execute them with per-commit confirmation. Default mode for `/code_assist:git_commit`.

Inherits format and rules from `shared.md`.

---

## Step 1: Analyze Changes

Run these in parallel:

```bash
git status
git diff --stat
git diff --cached --stat
```

Then read specific files with `git diff -- <file>` as needed. Do not load full diffs of large repos at once.

If there are no staged or unstaged changes, tell the user *"No changes to commit."* and stop.

---

## Step 2: Present the Commit Plan

Render the planned commit sequence before doing anything:

| # | Type | Summary (≤72 chars) | Files | Why |
|---|---|---|---|---|
| 1 | feat | add user registration endpoint | src/routes/register.ts, src/handlers/register.ts | enables self-service signup |
| 2 | test | cover registration handler edge cases | test/register.test.ts | guard against regressions |
| … | … | … | … | … |

---

## Step 3: Execute Per Commit

For each planned commit in order:

1. **Show** the commit row (header, body, files).
2. **Ask** the user: confirm · skip · edit · reorder.
3. **Stage** only the relevant files with `git add <paths>`.
4. **Commit** using a HEREDOC so multi-line messages format correctly:

   ```bash
   git add src/specific-file.ts src/other-file.ts
   git commit -m "$(cat <<'EOF'
   type: summary

   Body explaining what and why.
   Wrap lines at 72 characters.
   EOF
   )"
   ```

5. Move to the next commit.

---

## On Hook Failure

If a commit fails (pre-commit hook, lint, etc.), fix the root cause and create a **new** commit. Do not amend. Do not pass `--no-verify`.

---

## Stop Condition

Stop when all planned commits are processed (committed, skipped, or cancelled). Print `git status` at the end so the user can verify the working tree state.
