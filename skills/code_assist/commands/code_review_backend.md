---
name: code_assist:code_review_backend
description: Force backend code-review variant (skip stack detection)
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
Run the code-review workflow with the **backend** variant. Skip stack detection.
</objective>

<process>
1. Confirm you are inside a git repository. If not, tell the user and stop.
2. Read `/home/prjawal/.claude/skills/code_assist/code-review/shared.md`.
3. Read `/home/prjawal/.claude/skills/code_assist/code-review/backend.md`.
4. Execute Steps 1–6 from `shared.md` using the weight table and anti-pattern checklist from `backend.md`.
5. State files live at `.code_review/` (flat layout).
</process>
