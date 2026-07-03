---
name: sb:init
description: (Re)generate the vault's machine-facing entry docs — _CLAUDE.md (folder map, note types, AI-first/verified rules, command list) and index.md (per-folder counts, entry points, Base links). Idempotent and sentinel-bounded; hand-added content outside the sentinels survives. Use after adding folders/commands or to refresh the guide.
---

# /sb:init

```bash
node ~/.claude/skills/sb/commands/_runners/init.js
```

Writes `_CLAUDE.md` and `index.md` at the vault root. The generated region is
bounded by `<!-- @sb-generated:start/end -->` sentinels — re-running rewrites only
that region, so anything you add outside the sentinels is preserved. Called
automatically by `/sb:consolidate`. Show output verbatim.
