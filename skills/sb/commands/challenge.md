---
name: sb:challenge
description: Argue against a note using your own prior notes — a skeptical devil's-advocate pass that appends a ## Challenge section. Use to stress-test a lesson/zettel/decision before trusting it.
---

# /sb:challenge

```bash
node ~/.claude/skills/sb/commands/_runners/challenge.js <slug-or-path>
```

Appends a `## Challenge (<date>)` section (LLM-generated, clearly labelled). Never overwrites the
original body and does not change verified status. Show output verbatim.
