---
name: sb:related
description: Show the semantically nearest notes to a given note using smart-connections' precomputed vectors (key-free, note-to-note cosine). Use to find conceptually related notes that share no keywords. Falls back to lexical retrieval if vectors are missing.
---

# /sb:related

```bash
node ~/.claude/skills/sb/commands/_runners/related.js "<note-path-or-slug>" [--k N]
```

Reads `<vault>/.smart-env/multi/*.ajson` (bge-micro-v2, 384-dim) — no API key, no
re-embedding — and ranks other notes by cosine similarity to the target note. If
the note has no precomputed vector yet, open it in Obsidian so smart-connections
embeds it, or accept the lexical fallback. Show output verbatim.
