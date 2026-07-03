---
name: sb:zettel
description: Create an atomic permanent (Zettelkasten) note — claim-as-title, WHAT-layer body, related[]/sources[] backlinks. Use for durable, self-contained ideas distilled from study/conversation.
---

# /sb:zettel

```bash
node ~/.claude/skills/sb/commands/_runners/zettel.js "<claim as the title>" [--source <note-slug>] [--body "..."] [--why "..."] [--draft]
```

Title must be a full claim (e.g. "Backpressure prevents fast producers from overwhelming slow
consumers"), not a topic word. `--draft` lets Haiku expand the claim (note is then marked
unverified — run `/sb:verify` after review). Auto-links related notes by title overlap. Show
output verbatim.
