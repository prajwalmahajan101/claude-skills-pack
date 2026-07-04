---
name: sb:ingest
description: Write a supplied set of notes into the vault (generic, skill-agnostic). Reads a JSON payload from stdin or --payload <file> and writes each note as a typed project note, optionally refreshing an open-issues section. Used by the sutra orchestrator to land parsed repo artifacts in the vault; usable directly for any structured note payload.
---

# /sb:ingest

```bash
node ~/.claude/skills/sb/commands/_runners/ingest.js --payload <file>
# or pipe the payload on stdin:
cat payload.json | node ~/.claude/skills/sb/commands/_runners/ingest.js
```

Payload shape:

```json
{ "project": "<slug>",
  "notes": [ { "folder": "journal", "name": "M1.md", "type": "journal", "title": "…", "content": "…" } ],
  "openIssues": [ { "id": "ISSUE-001", "severity": "high", "title": "…" } ] }
```

sb holds knowledge handed to it — it does not read any repository or know what produced the notes.
The **sutra** orchestrator parses repository artifacts into this payload (`sutra-tools sync-artifacts`)
and feeds it here, so the second brain mirrors engineering artifacts without sb ever depending on the
producer's format.
