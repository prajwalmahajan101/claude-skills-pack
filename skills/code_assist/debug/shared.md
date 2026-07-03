---
name: code_assist/debug/shared
description: The scientific-method debugging protocol and DEBUG.md session format. Included by investigate and resume.
type: shared
---

# Debug - Shared Protocol

Debugging is scientific method, not guess-and-check. The Iron Law: **no fix without a
reproduced root cause.**

## DEBUG.md session format
`.code_assist/.debug/DEBUG.md`:
```markdown
# Debug: <one-line symptom>

_Started: <date> · Status: investigating | root-caused | fixed | verified_

## Symptom
What is observed, exact error/output, when it happens.

## Reproduction
The minimal, reliable steps/command to trigger it. (If you can't reproduce, that IS the
current task.)

## Hypotheses
- H1: <mechanism> — prediction if true — test — RESULT.
- H2: …

## Root cause
The proven mechanism (only once a test confirmed it).

## Fix
What changed and why it addresses the root cause (not the symptom).

## Regression test
The test that now fails without the fix and passes with it.
```

## The loop
1. **Reproduce** reliably. No reproduction → reproduction is the task.
2. **Observe** - read the actual error, logs, stack, state. Use `graph context <symbol>`
   and `graph detect-changes` to see what recently changed around the failure.
3. **Hypothesize** one mechanism with a falsifiable prediction.
4. **Test** the hypothesis (add logging, a probe, a unit test). Record the result.
5. Repeat 3-4 until a hypothesis is confirmed = **root cause**.
6. Only then fix - at the root cause. Add a **regression test** first (Iron Law #2).
7. `verify` the fix; update DEBUG.md status.

## Red flags (STOP)
- "I'll just try changing this and see." → No. Form a hypothesis first.
- "It's probably X." → Prove X with a test before touching code.
- Fixing the symptom (swallowing the error, adding a retry) instead of the cause.
