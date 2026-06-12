---
name: sb:project
description: List all second-brain projects with stats, or print a specific project's INDEX.md. Usage: /sb:project [<slug>]
---

# /sb:project

Run the runner and show its output:

```bash
node ~/.claude/skills/sb/commands/_runners/project.js $ARGUMENTS
```

- No arg: tabular list of all projects (CONVS / TASKS / LESSONS / LAST modified).
- With slug: prints that project's `INDEX.md`.
