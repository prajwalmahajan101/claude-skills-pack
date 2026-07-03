---
name: sb:lessons-import
description: Converge the global ~/.claude/lessons store with the vault — import each global lesson into 03_Lessons as an AI-first note; with --push also register sb lessons back in the global INDEX.
---

# /sb:lessons-import

```bash
node ~/.claude/skills/sb/commands/_runners/lessons-import.js
```

Two-way (also push sb lessons to the canonical `~/.claude/lessons/INDEX.md`):

```bash
node ~/.claude/skills/sb/commands/_runners/lessons-import.js --push
```

Import is idempotent (dedupes by slug). Show output verbatim. `/sb:consolidate --apply` runs
the import automatically so all three lesson stores (global, vault, memory) stay converged.
