---
name: sb:ask-highlights
description: Hallucination-proof retrieval — returns only verbatim vault lines matching a query (quotes, highlights, bullet claims) with file:line provenance, never generated prose. The safe complement to /sb:search.
---

# /sb:ask-highlights

```bash
node ~/.claude/skills/sb/commands/_runners/ask-highlights.js "<query>" [--type <noteType>] [--limit N]
```

Every result is a literal line copied from a note plus its `file:line`. Nothing is summarized or
generated. Show output verbatim.
