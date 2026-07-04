---
name: code_assist:git_commit
description: Atomic git commit generator — routes to dry-run plan or interactive execution
argument-hint: [--dry-run | <scope hint>]
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Run the `code_assist` git-commit router against the current repository.

The router and sub-skill files are the single source of truth — read them and follow exactly. Do **not** duplicate their logic here.
</objective>

<arguments>
User-supplied hint: **$ARGUMENTS**

Interpret as follows:
- Contains `--dry-run`, `dry-run`, `plan only`, `just plan`, `suggest commits`, `preview` → **plan mode** (no staging, no committing)
- Otherwise → **interactive execute mode** (default)
- Any other tokens → treat as a scoping hint and pass into the sub-skill's analysis
</arguments>

<process>
1. Confirm you are inside a git repository (`git rev-parse --is-inside-work-tree`). If not, tell the user and stop.
2. Read `~/.claude/skills/code_assist/git-commit/ROUTER.md` fully and execute it.
3. Respect the sub-skill's rules: specific file staging only, no `--no-verify`, no amend without explicit user request, new commit on hook failure.
</process>
