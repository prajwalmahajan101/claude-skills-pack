---
name: unabridged:continuation
description: Long-output continuation protocol — clean breakpoint markers and resume-without-recap rules. Loaded when output is approaching the token limit under the unabridged skill.
---

# Unabridged — Continuation Protocol

The only acceptable response to "approaching the token limit" is a clean pause + clean resume. Never compress, never skip ahead to a conclusion, never bail out.

## When to Pause

Pause **only** at clean structural boundaries:

- End of a file.
- End of a function / class / method.
- End of a top-level section (`## …` in markdown).
- End of a complete list item that is itself complete.

**Never** pause mid-function, mid-sentence, mid-JSX-tag, mid-loop. If you're not near a clean boundary, you're not near the token limit yet — keep going.

## Pause Marker Format

Emit this verbatim at the breakpoint:

```
[PAUSED — X of Y complete. Send "continue" to resume from: <anchor>]
```

- `X` = count of deliverables fully emitted.
- `Y` = locked scope count from the SKILL.md Execution Process step 1.
- `<anchor>` = the next concrete thing to produce. Specific. `"file 3 of 5: src/api/users.ts"`, not `"the next file"`.

## Resume Rules

On receiving `continue`:

1. **No recap.** Do not restate what you produced last turn. The user can scroll.
2. **No repetition.** Do not re-emit the last function/section "for context."
3. **Pick up exactly at `<anchor>`.** First character of your output is the next line of work.
4. **Same skill still applies.** Continuation does not reset banned patterns — code/SKILL.md and prose/SKILL.md still bind.
5. **Re-pause if needed.** Multi-pause sequences are fine. Each pause uses the same marker, X advances, Y stays fixed.

## Anti-Patterns

- Squeezing the last three deliverables into a tight summary to "finish in this turn." — Pause instead.
- Saying "continued from previous response, where we built X and Y…" — Don't recap. Resume.
- Skipping the marker and just stopping. — The marker is the contract; without it the user doesn't know to send `continue`.

See `../EXAMPLES.md` for a worked pause/resume pair.
