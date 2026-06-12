---
name: sb:ask
description: Ask a natural-language question about your vault. Retrieves the most relevant notes (lessons, topics, conversations) lexically, then synthesizes an answer with cited [[wikilink]] sources via `claude -p`. Usage — `/sb:ask "what did I learn about X?"`. Supports `tag:#area/sub` filters in the query.
---

# /sb:ask

```bash
node ~/.claude/skills/sb/commands/_runners/ask.js $ARGUMENTS
```

Shows the retrieved notes first (top 10), then streams the synthesized answer. Citations appear inline as `[[note-name]]` so they're clickable in Obsidian.

Defaults to Sonnet (~$0.02/query). Set `SB_ASK_MODEL=claude-haiku-4-5-20251001` for cheaper Haiku.
