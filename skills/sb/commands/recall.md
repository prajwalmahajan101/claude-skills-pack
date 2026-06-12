---
name: sb:recall
description: Surface relevant past lessons/topics/connections for the current conversation's context (last 3000 chars + tags). No LLM, instant. Useful when starting to dig into a problem to see "what do I already know?".
---

# /sb:recall

```bash
node ~/.claude/skills/sb/commands/_runners/recall.js
```

Reads the most-recently-written conversation file (current session) and finds the top 5 related notes via tag overlap + keyword similarity. Shows a one-line snippet under each.
