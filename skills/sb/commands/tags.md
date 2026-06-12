---
name: sb:tags
description: Show tag hierarchy with counts. `--prune` strips invalid tags from all vault notes (length<3, malformed, brackets) and applies the alias table.
---

# /sb:tags

```bash
node ~/.claude/skills/sb/commands/_runners/tags.js $ARGUMENTS
```

Default: print sorted tag→count list. `--prune` rewrites every note's frontmatter to drop garbage tags and merge aliases (`#js → #lang/javascript`, `#k8s → #infra/kubernetes`, etc.), then rebuilds `tags.md`.
