---
name: sutra:commit
description: Atomic commit, composed across the pack — ground the change in graph impact, run code_assist's atomic Conventional-Commits flow, then offer a journal update and a lesson capture. Triggers on "sutra commit", "commit and journal", "commit across the pack".
argument-hint: [--dry-run | <scope hint>]
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

# /sutra:commit

Confirm members first (`sutra-tools.js registry`); each bridge step no-ops if its member is absent.

1. **Impact (pre):** if **code_assist** is present, `node ~/.claude/skills/code_assist/bin/ca-tools.js
   graph review-prep .` to see the blast radius of the staged change (informs commit scoping + message).
2. **Commit (member):** read `~/.claude/skills/code_assist/git-commit/ROUTER.md` and execute it —
   atomic Conventional Commits, specific-file staging, no `--no-verify`, **no AI attribution footer**.
   Do NOT duplicate its logic.
3. **Journal (post, optional):** offer to update the phase journal referencing the new SHAs via
   code_assist's `journal` family, then `/sutra:sync` it to the vault.
4. **Capture (post, optional):** if the commit resolved something durable, offer `/sutra:capture`.

Report the chain.
