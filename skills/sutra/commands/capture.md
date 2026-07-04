---
name: sutra:capture
description: Capture a durable lesson into the second brain and record it in the feedback loop, so recall surfaces it next time. Composes sb's lesson capture with sutra's loop-emit. Triggers on "capture this lesson", "remember this across the pack", "log the takeaway".
argument-hint: "<lesson title>" [--risk]
allowed-tools:
  - Bash
---

# /sutra:capture

1. If **sb** is present, capture the lesson from the current session:

   ```bash
   node ~/.claude/skills/sb/commands/_runners/lesson.js "$ARGUMENTS"
   ```

2. Record it in the pack's feedback loop (durable even if sb is absent):

   ```bash
   node ~/.claude/skills/sutra/bin/sutra-tools.js loop-emit --event capture --note "$ARGUMENTS" [--risk]
   ```

Lessons tagged `risk` are exactly what `/sutra:recall` surfaces in future work — writing out feeds the
pull-back. If sb is absent, the takeaway still lands in `.sutra/loop.jsonl`; promote it to the vault
once sb is installed.
