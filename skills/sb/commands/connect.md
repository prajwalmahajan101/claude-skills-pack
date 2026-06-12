---
name: sb:connect
description: Suggest links between the current (or a named) note and existing vault notes. Usage — `/sb:connect` (uses current session's conversation) or `/sb:connect --file <path>`. To accept, run `/sb:connect --accept <comma-paths> [--theme <name>]`.
---

# /sb:connect

```bash
node ~/.claude/skills/sb/commands/_runners/connect.js $ARGUMENTS
```

Steps:
1. Run the runner with no `--accept` to print top-5 ranked candidates (tag overlap + keyword similarity + recency).
2. Ask the user which to link (free-form: "1 2 4", "all", "none").
3. If they accept any, re-invoke with `--accept <comma-separated-relative-paths> --theme <theme-slug>` to write the MOC note under `connections/<theme>.md`.

Show ranked output, then prompt for selection. Keep interaction short.
