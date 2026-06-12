---
name: sb:task
description: Manage project kanban tasks. `/sb:task new "<title>"` creates a rich task note + wikilinked kanban entry. `/sb:task add "<text>"` adds a one-line item. `/sb:task done <n|prefix>` completes a task (and marks the task note done if linked). `/sb:task doing <n|prefix>` moves to Doing.
---

# /sb:task

```bash
node ~/.claude/skills/sb/commands/_runners/task.js $ARGUMENTS
```

Subcommands:
- `new "<title>" [--tag x] [--due YYYY-MM-DD] [--project <slug>]` → creates `tasks/<project>/<date>-<slug>.md` (with Context/Goal/Sub-steps/Blockers/Related/Notes template) AND a kanban "To Do" entry with `[[wikilink]]`.
- `add "<text>" [--tag x] [--due YYYY-MM-DD] [--project <slug>]` → one-line kanban entry only (no task note).
- `done <n|prefix>` → moves from To Do/Doing to Done; if the kanban line has a wikilink, also flips the task note's `status: done` and stamps `completed_at`.
- `doing <n|prefix>` → moves from To Do to Doing.
