---
name: sb:clean
description: Vault cleanup. Dry-run by default; pass `--apply` to hard-delete. Removes empty conversations, garbage tags, stale session-map entries. Reports project slug mismatches to migrate separately.
---

# /sb:clean

```bash
node ~/.claude/skills/sb/commands/_runners/clean.js $ARGUMENTS
```

Phases:
1. Empty conversations (turn_count < 2 by default; `--min-turns=N` to override).
2. Garbage tags purged from all notes.
3. Project slug mismatches surfaced (run `sb-migrate-slugs.js` to fix).
4. Stale session-map entries (files no longer on disk).

**No `_archive/`** — `--apply` hard-deletes. Dry-run lists everything first; always preview before applying.
