---
name: sutra:review
description: Architectural code review, composed across the pack — recall prior risks first, run code_assist's review (blast-radius-grounded via graph review-prep), then sync the review state to the sb vault and offer to capture lessons. Triggers on "review across the pack", "sutra review", "review and capture".
argument-hint: [scope — e.g. "full", "my changes", "last commit"]
allowed-tools:
  - Task
  - Read
  - Bash
  - Grep
  - Glob
  - Edit
  - AskUserQuestion
---

# /sutra:review

Compose a review with the pack's memory and code-intelligence around it. Confirm members first
(`sutra-tools.js registry`); each bridge step no-ops if its member is absent.

1. **Recall (pre):** surface prior risks/regressions for the changed area —
   `node ~/.claude/skills/sutra/bin/sutra-tools.js recall --context "code review: $ARGUMENTS" --limit 5`.
   Lead the review with any risks (cite `ref`s).
2. **Review (member):** if **code_assist** is present, read
   `~/.claude/skills/code_assist/code-review/ROUTER.md` and execute it for scope `$ARGUMENTS`. Its
   Step 2.0 runs `graph review-prep` so severity is blast-radius-grounded. Do NOT duplicate its logic.
3. **Sync (post):** after the review writes `.code_review/` state, land it in the vault —
   `node ~/.claude/skills/sutra/bin/sutra-tools.js sync-artifacts . > /tmp/p.json` then, if **sb** is
   present, `node ~/.claude/skills/sb/commands/_runners/ingest.js --payload /tmp/p.json`.
4. **Capture (post):** for any generalizable finding, offer `/sutra:capture "<title>" --risk`.

Report the chain (e.g. "recall(2 risks) → review(3 issues, graph-grounded) → synced → captured 1").
