---
name: code_assist:code_review
description: Senior architectural code review with stack-aware routing (backend / frontend / tui / fullstack)
argument-hint: [scope — e.g. "full", "my changes", "last commit", "pr"]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

<objective>
Run the `code_assist` code-review router against the current repository.

The router and sub-skill files are the single source of truth — read them and follow exactly. Do **not** duplicate their logic here.
</objective>

<arguments>
User-supplied scope hint: **$ARGUMENTS**

Interpret as follows:
- Empty, or "full", or "codebase", or "architecture" → **full architectural review** (router runs stack detection)
- "my changes", "pr", "last commit", "staged", "diff" → **targeted review** (shortcut in router, skips detection)
- Anything else → pass through as additional scope context
</arguments>

<process>
1. Confirm you are inside a git repository (`git rev-parse --is-inside-work-tree`). If not, tell the user and stop.
2. Read `~/.claude/skills/code_assist/code-review/ROUTER.md` fully and execute it.
3. Remember: `code_review_history.md` and `learning.md` are **living documents** — regenerate them, never append.
</process>
