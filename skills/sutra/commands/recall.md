---
name: sutra:recall
description: Reason with prior knowledge across the pack. Fused recall — composes code_assist's base recall (harness lessons/memory/risks) with sb's verbatim vault highlights, deduped, with file:line provenance. Triggers on "what do we know about", "recall across the pack", "prior lessons and vault".
argument-hint: <task / symptom / area>
allowed-tools:
  - Bash
---

# /sutra:recall

```bash
node ~/.claude/skills/sutra/bin/sutra-tools.js recall --context "$ARGUMENTS" --limit 5
```

Composes each present member's knowledge: code_assist's base recall (global lessons, project
`MEMORY.md`, `~/.remember`) **and** sb's vault highlights. Output is JSON; **lead with `risks`, cite
each item's `ref` (file:line), never paraphrase a lesson into a claim it doesn't make.** Returns empty
(never fabricates) when neither member is present.
