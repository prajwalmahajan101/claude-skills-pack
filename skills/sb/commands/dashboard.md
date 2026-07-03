---
name: sb:dashboard
description: Regenerate the Life-Dashboard homepage (00_Dashboard/Home.md + Today.md) — embedded Bases (review queue, tasks, decisions, people, meetings), Dataview recent lessons/zettels, habit streaks, and memory/remember highlights. Points the homepage plugin at Home.md.
---

# /sb:dashboard

```bash
node ~/.claude/skills/sb/commands/_runners/dashboard.js
```

Idempotent — regenerate anytime; also refreshed by `/sb:consolidate`. Open `00_Dashboard/Home.md`
in Obsidian (the homepage plugin is pointed at it). Show output verbatim.
