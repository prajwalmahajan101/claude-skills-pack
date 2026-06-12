---
name: sb:find
description: Fuzzy filename/title lookup across the vault. Usage — `/sb:find <fragment>`. Fast, no LLM. For full-text content search use /sb:search; for Q&A use /sb:ask.
---

# /sb:find

```bash
node ~/.claude/skills/sb/commands/_runners/find.js $ARGUMENTS
```

Returns up to 20 ranked matches as `path  title`.
