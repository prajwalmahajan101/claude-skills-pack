---
name: sb:backfill
description: One-shot import of historical Claude Code conversations from `~/.claude/projects/*.jsonl` into the vault. NOT run automatically. Usage — `/sb:backfill [--days N | --all] [--dry-run]`.
---

# /sb:backfill

```bash
node ~/.claude/skills/sb/commands/_runners/backfill.js $ARGUMENTS
```

Default: last 30 days. Pass `--days 90` or `--all` to widen. `--dry-run` previews without writing.

Skips sessions already in `_meta/session-map.json`. Idempotent.

Show output verbatim. After a large backfill, suggest running `/sb:analyze` to mine lessons from the imported conversations.
