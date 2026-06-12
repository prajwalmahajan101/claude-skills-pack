---
name: sb:topic
description: Create or append to an evergreen topic/study note. Usage — `/sb:topic <slug-or-title>` (e.g. `/sb:topic crud`, `/sb:topic event-sourcing`).
---

# /sb:topic

```bash
node ~/.claude/skills/sb/commands/_runners/topic.js $ARGUMENTS
```

Topics are reference notes for subjects you study or work with repeatedly (CRUD, observability, k8s, etc.). First call creates `topics/<slug>.md` from template. Subsequent calls append a "Source Log" entry linking the current conversation.

Show output verbatim.
