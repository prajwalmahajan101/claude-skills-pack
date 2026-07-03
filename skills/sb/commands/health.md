---
name: sb:health
description: Deterministic, read-only vault audit — orphan notes, duplicate clusters, stale tasks, missing/malformed frontmatter, empty folders, unfilled templates. Pair with /sb:consolidate to fix.
---

# /sb:health

```bash
node ~/.claude/skills/sb/commands/_runners/health.js
```

Read-only. Show output verbatim. Add `--json` for machine-readable output. Nothing is
modified — fixes are surfaced only. To act on duplicates/stale notes, run `/sb:consolidate`.
