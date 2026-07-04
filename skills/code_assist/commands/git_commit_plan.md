---
name: code_assist:git_commit_plan
description: Generate a dry-run commit plan with paste-able commands — never stages or commits
argument-hint: [scope hint]
allowed-tools:
  - Read
  - Bash
---

<objective>
Run the git-commit **plan** sub-skill. Output a commit plan table + a stacked code block of `git add`/`git commit` commands. Do **not** stage. Do **not** commit.
</objective>

<process>
1. Confirm you are inside a git repository. If not, tell the user and stop.
2. Read `~/.claude/skills/code_assist/git-commit/shared.md` for message format and global rules.
3. Read `~/.claude/skills/code_assist/git-commit/plan.md` and follow it exactly.
4. Stop after emitting commands — do not execute them.
</process>
