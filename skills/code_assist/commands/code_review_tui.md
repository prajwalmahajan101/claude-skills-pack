---
name: code_assist:code_review_tui
description: Force TUI / CLI code-review variant (skip stack detection)
argument-hint: [scope hint]
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
Run the code-review workflow with the **TUI / CLI** variant. Skip stack detection.
</objective>

<process>
1. Confirm you are inside a git repository. If not, tell the user and stop.
2. Read `~/.claude/skills/code_assist/code-review/shared.md`.
3. Read `~/.claude/skills/code_assist/code-review/tui.md`.
4. Execute Steps 1–6 from `shared.md` using the weight table and anti-pattern checklist from `tui.md`.
5. State files live at `.code_review/` (flat layout).
</process>
