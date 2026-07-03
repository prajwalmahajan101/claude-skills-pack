---
name: sb:decision
description: Capture an architecture decision (ADR) as an AI-first vault note — numbered Context/Decision/Consequences/Usage under 02_Projects/<slug>/decisions/ plus a global 11_Decisions copy. Use for "why did we choose", ADRs, and council verdicts.
---

# /sb:decision

```bash
node ~/.claude/skills/sb/commands/_runners/decision.js "<title>" [--project <slug>] [--from-council] [--status accepted|proposed|superseded]
```

Optionally pass the body directly instead of letting Haiku draft it from the session:

```bash
node ~/.claude/skills/sb/commands/_runners/decision.js "Use transactional outbox" \
  --context "..." --decision "..." --consequences "..." --usage "..."
```

`--from-council` tags the ADR as a council verdict and adds a Voices section. Numbering
auto-increments per project. Show output verbatim.
