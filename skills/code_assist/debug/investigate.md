---
name: code_assist/debug/investigate
description: Start a fresh scientific-method debug session - reproduce, hypothesize, test to a proven root cause, then fix with a regression test.
type: skill
---

# Debug - Investigate

Follow `shared.md`'s loop. Open (or overwrite) `.code_assist/.debug/DEBUG.md`.

## Prior knowledge (from memory)
`node bin/ca-tools.js recall --context "<the symptom / error / component>" --limit 5` - a past
root-cause or a risk `ref` for this area often points straight at the mechanism. Treat it as a
lead to test, never as the answer (the Iron Law still holds: no fix without a reproduced cause).

## Steps (one todo each)
1. **Capture the symptom** - exact error/output, and the conditions under which it appears.
2. **Reproduce** it reliably; write the reproduction into DEBUG.md. If you cannot reproduce,
   your only task is to make it reproducible - do not proceed to fixes.
3. **Gather evidence** - logs, stack traces, state; `node bin/ca-tools.js graph context <sym>`
   for callers/callees; `graph detect-changes` to see if a recent diff is implicated.
4. **Hypothesize → test → record**, one mechanism at a time, until a test confirms the
   **root cause**. Write it in DEBUG.md.
5. **Regression test first** (Iron Law #2): add a test that fails because of the bug.
6. **Fix at the root cause**; the regression test now passes.
7. **Verify** (hand to `verify`), set DEBUG.md status `verified`, then `commit` (type `fix`).

## Rules
- Never fix before step 4 confirms the cause. A plausible guess is not a root cause.
- Fix the cause, not the symptom - no swallowed errors, no blind retries, no magic fallbacks.
