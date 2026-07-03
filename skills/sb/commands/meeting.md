---
name: sb:meeting
description: Create a meeting note with auto-linked attendees — Agenda/Notes/Decisions/Action Items, attendees linked to People notes (stubs created if missing) with interaction-log entries.
---

# /sb:meeting

```bash
node ~/.claude/skills/sb/commands/_runners/meeting.js "<title>" [--attendees "a,b,c"] [--at "YYYY-MM-DD HH:mm"] [--mins 60]
```

Attendees become `12_People` notes and each gets an interaction-log line for this meeting. Show
output verbatim.
