---
name: sb:idea
description: Capture an idea into 16_Ideas/ (type: idea, status: captured). List bullet points in --body and they become the graduation checklist. Use for "I have an idea", "capture this idea", "note this for later" — a lightweight seed you can later /sb:graduate into a real project.
---

# /sb:idea

```bash
node ~/.claude/skills/sb/commands/_runners/idea.js "<title>" [--body "point one; point two"] [--tags a,b] [--project <slug>]
```

Bullets in `--body` (newline- or `;`-separated) are stored under `## Idea` and become
kanban cards when you run `/sb:graduate`. Show output verbatim.
