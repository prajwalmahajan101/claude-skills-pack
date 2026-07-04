---
name: sutra:verify
description: Verify a change works, composed across the pack — recall what evidence mattered before, run code_assist's goal-backward verification, then emit a feedback-loop event and offer to capture the outcome as a lesson. Triggers on "sutra verify", "verify and remember", "confirm it works across the pack".
argument-hint: <the goal / what to verify>
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

# /sutra:verify

Confirm members first (`sutra-tools.js registry`); each bridge step no-ops if its member is absent.

1. **Recall (pre):** `node ~/.claude/skills/sutra/bin/sutra-tools.js recall --context "verify: $ARGUMENTS"`
   — reuse what evidence mattered before.
2. **Verify (member):** if **code_assist** is present, read `~/.claude/skills/code_assist/verify/ROUTER.md`
   and execute it — fresh evidence run THIS session (its Iron Law: no "done" without evidence). Do NOT
   duplicate its logic.
3. **Loop (post):** record the outcome — `node ~/.claude/skills/sutra/bin/sutra-tools.js loop-emit
   --event verify --note "<outcome>" [--risk]`.
4. **Capture (post):** offer `/sutra:capture "<title>"` for the durable takeaway — which `recall`
   surfaces next time (the closed loop).

Report the chain.
