---
name: code_assist:journal
description: Create or update a phase journal entry in .journal/M<phase>.md from the project's TEMPLATE.md
argument-hint: [M<phase> | new | update | <free-form note>]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
Run the `code_assist` journal router against the current repository. Create a fresh `.journal/M<phase>.md` from `TEMPLATE.md`, or append to an existing one — never both.

The router and sub-skill files are the single source of truth — read them and follow exactly. Do **not** duplicate their logic here.
</objective>

<arguments>
User-supplied hint: **$ARGUMENTS**

Interpret as follows:
- Starts with `M<phase>` (e.g. `M1.5`, `M2.0`) → use that phase identifier; otherwise discover per `shared.md`.
- Contains `new`, `start`, `create`, `open phase` → **new mode** (refuse if file already exists).
- Contains `update`, `append`, `log`, `ratify`, `close out` → **update mode**.
- Otherwise → router picks based on whether `M<phase>.md` already exists.
- Any remaining tokens → treat as the journal note / goal text and pass into the sub-skill.
</arguments>

<process>
1. Confirm you are inside a git repository (`git rev-parse --is-inside-work-tree`). If not, tell the user and stop.
2. Read `~/.claude/skills/code_assist/journal/ROUTER.md` fully and execute it.
3. Respect the sub-skill's rules: never overwrite existing entries silently, never invent commits or shas, never leak secrets, never commit the journal file.
</process>
