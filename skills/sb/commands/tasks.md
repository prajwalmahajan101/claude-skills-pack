---
name: sb:tasks
description: List pending kanban tasks (Doing + To Do) for the current project, or across all projects. Usage: /sb:tasks [--all] [--project <slug>]
---

# /sb:tasks

```bash
node ~/.claude/skills/sb/commands/_runners/tasks.js $ARGUMENTS
```

Show output verbatim. Default scope = current project (cwd). `--all` lists every project that has open tasks. `--project <slug>` targets a specific project.
