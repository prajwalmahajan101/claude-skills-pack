---
name: sb:weekly
description: Synthesize a weekly review of the past 7 days' lessons and completed tasks. Spawns `claude -p` (Sonnet) for narrative synthesis; writes `reviews/<YYYY-WNN>.md` with themes, top learnings, open items, and cross-project patterns.
---

# /sb:weekly

```bash
node ~/.claude/skills/sb/commands/_runners/weekly.js
```

Cost: ~$0.05–0.15 per weekly. Auto-skipped if zero lessons + tasks in the past 7 days.
