---
name: sb:kanban
description: Print or open the project's kanban board. Usage — `/sb:kanban [--project <slug>] [--open]`.
---

# /sb:kanban

```bash
node ~/.claude/skills/sb/commands/_runners/kanban.js $ARGUMENTS
```

Default: print the markdown to terminal. `--open` invokes `obsidian` CLI to open the file in the app (rendered as columns if Kanban plugin installed).
