---
name: code_assist/debug/resume
description: Resume an existing debug session from DEBUG.md - reload the hypotheses tried, and continue the loop from where it stopped.
type: skill
---

# Debug - Resume

Precondition: `.code_assist/.debug/DEBUG.md` exists.

## Steps
1. **Read DEBUG.md** fully - symptom, reproduction, hypotheses already tested (and their
   results), current status.
2. **Re-confirm reproduction** still holds (the code may have moved).
3. **Continue the loop** from `shared.md` at the next untested hypothesis. Do not re-test
   disproven hypotheses; do not restart from scratch.
4. On root cause: regression test first, fix at the cause, `verify`, update status, `commit`.

## Rules
- Trust the recorded results - extend the investigation, don't discard it.
- If new evidence contradicts a recorded result, note the contradiction and re-test that
  hypothesis explicitly.
