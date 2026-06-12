---
name: sb:analyze
description: Mine conversations into structured lessons (Context/Insight/Why/When/Pitfalls/Examples/Related), takeaways, action items, and tags. Uses `claude -p` with Sonnet by default. Usage — `/sb:analyze` (all unanalyzed), `/sb:analyze <sid_prefix>`, `/sb:analyze --force` (re-analyze even completed ones).
---

# /sb:analyze

```bash
node ~/.claude/skills/sb/commands/_runners/analyze.js $ARGUMENTS
```

Flags:
- `<sid_prefix>` — analyze just one conversation (matches session-id prefix).
- `--force` — re-analyze conversations already marked `analyzed: true` (use after upgrading the analyzer prompt).

Side effects per conversation:
- Writes one structured lesson note per insight at `lessons/<date>-<slug>.md`.
- Appends summary + takeaways to `projects/<slug>/lessons.md`.
- Adds action items to project kanban `## To Do`.
- Merges suggested tags into conversation frontmatter (after the tag-taxonomy guard rejects garbage).
- Marks conversation `analyzed: true`.
- Rebuilds `tags.md`.

Cost: ~$0.05–0.20 per conversation at Sonnet (default). Set `SB_LESSON_DEPTH=brief` for Haiku and roughly 10x cheaper, lower quality.
