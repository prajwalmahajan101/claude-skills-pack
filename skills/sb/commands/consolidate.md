---
name: sb:consolidate
description: Bound vault growth — dedupe lessons, flag stale conversations + orphans, promote durable lessons into harness memory. Dry-run by default; --apply to merge/archive (never hard-deletes).
---

# /sb:consolidate

Dry-run (default — writes a report to `99_Inbox/`, changes nothing else):

```bash
node ~/.claude/skills/sb/commands/_runners/consolidate.js
```

Apply (merge duplicate lessons into the newest with a provenance section, move stale analyzed
conversations to `_archive/`, promote durable lessons to memory, regenerate Bases):

```bash
node ~/.claude/skills/sb/commands/_runners/consolidate.js --apply
```

Always inspect the dry-run report first. `--apply` never hard-deletes — it merges and moves to
`_archive/`. Env: `SB_CONSOLIDATE_STALE_DAYS` (default 90), `SB_MEMORY_PROMOTE=0` to skip
memory promotion.
