---
name: sb:search
description: Full-text search the second-brain vault via the Obsidian CLI. Usage — `/sb:search <query>`. Supports Obsidian search syntax (`tag:#x`, `path:foo`, `file:bar`).
---

# /sb:search

```bash
node ~/.claude/skills/sb/commands/_runners/search.js $ARGUMENTS
```

Show output verbatim. Requires the Obsidian app to be running and the CLI registered (`~/.local/bin/obsidian` in PATH). If the runner errors with "obsidian CLI not found", point the user at the README's "Prerequisites" section.
