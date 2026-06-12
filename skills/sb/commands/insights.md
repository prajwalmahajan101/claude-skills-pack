---
name: sb:insights
description: Cross-project pattern detection — surfaces tags that appear in ≥ 2 lessons across ≥ 2 projects ("you've hit auth issues 4 times across 3 projects"). Writes `connections/recurring-themes.md`.
---

# /sb:insights

```bash
node ~/.claude/skills/sb/commands/_runners/insights.js
```

Tune via env: `SB_INSIGHTS_MIN_PROJECTS=2`, `SB_INSIGHTS_MIN_LESSONS=2`.
