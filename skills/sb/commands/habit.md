---
name: sb:habit
description: Habit tracker — log a habit as done today (with streak) or list all habits and their current streaks. Use for "did X today", "track habit Y", "show my streaks".
---

# /sb:habit

List all habits + today's status + streaks:

```bash
node ~/.claude/skills/sb/commands/_runners/habit.js --list
```

Create / log a habit as done today:

```bash
node ~/.claude/skills/sb/commands/_runners/habit.js "<name>" --done [--cadence daily]
```

Show output verbatim.
