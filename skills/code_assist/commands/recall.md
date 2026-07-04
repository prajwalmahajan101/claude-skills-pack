---
name: code_assist:recall
description: Pull relevant prior lessons, durable memory, and known risks for the task at hand - with file:line provenance. Triggers on "what do we know about", "any past lessons on", "recall", "known risks for".
---

# /code_assist:recall

Surface accumulated knowledge so the current work reasons WITH it instead of rediscovering it.

Run:

```
node ~/.claude/skills/code_assist/bin/ca-tools.js recall --context "<the task / symptom / area>" [--limit 5] [--kinds lessons,risks,memory]
```

It reads three stores directly (self-contained): global lessons (`~/.claude/lessons/`), the
project's harness memory (`MEMORY.md`), and the rolling `~/.remember/recent.md`. Output is JSON;
**every item carries a `ref` (file:line) - cite it, never paraphrase a lesson into a claim it
doesn't make.**

Then: lead with **risks** (things to avoid), fold the top lessons/memory into your approach, and
name the source when you rely on one ("prior lesson [ref] says ..."). If nothing relevant returns,
say so and proceed - absence of a prior lesson is not a blocker.

Most families call this automatically (see their "Prior knowledge (from memory)" step); use this
command for an explicit, standalone pull.
