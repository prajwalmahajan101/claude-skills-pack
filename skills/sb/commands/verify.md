---
name: sb:verify
description: Mark an AI-drafted note as human-verified — flips verified:false→true, stamps verified_by/at, and removes the [!ai] unverified callout. Clears it from the unverified review queue.
---

# /sb:verify

```bash
node ~/.claude/skills/sb/commands/_runners/verify.js <slug-or-path> [--by <name>]
```

Use after reviewing a Haiku-drafted lesson/decision/zettel. Show output verbatim. See the
`unverified.base` view for the pending review queue.
