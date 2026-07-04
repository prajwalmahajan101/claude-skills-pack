---
name: code_assist/secure/git-hooks
description: Install the code_assist guardrails as real git hooks (.githooks/ + core.hooksPath) so secret-scan + Conventional-Commit lint run on every commit - in a plain terminal, not just inside a Claude Code session.
type: skill
---

# Secure - Git Hooks

Goal: make the guardrails survive outside Claude Code. The `ca-git-guard` Claude hook only fires
inside a session; these git hooks run on **every** `git commit`, for everyone who clones the repo.

## Steps (one todo each)
1. **Preview:** `node bin/ca-tools.js install-git-hooks [dir]` - dry-run; lists the files it would
   write (`.githooks/pre-commit`, `.githooks/commit-msg`) and the `core.hooksPath` change.
2. **Apply:** `node bin/ca-tools.js install-git-hooks [dir] --apply` - writes the hooks (executable)
   and sets `core.hooksPath=.githooks`. Idempotent (re-running skips unchanged files).
3. **Commit the `.githooks/` dir** so the whole team gets the same guardrails (they still must run
   `git config core.hooksPath .githooks` once, or re-run `install-git-hooks --apply`).
4. **Verify:** stage a fake secret and try a plain `git commit` - the pre-commit hook blocks it;
   try a non-Conventional message - the commit-msg hook rejects it.

## What the hooks enforce (same rules as `ca-git-guard`)
- **pre-commit:** `secret-scan --staged` (blocks on a hit) + protected-branch warning (blocks only
  under `CA_GIT_GUARD_STRICT=1`).
- **commit-msg:** Conventional-Commit type + subject ≤72 chars (merge/revert/fixup exempt).

## Controls
- `CA_DISABLE=1` mutes both hooks. `CA_GIT_GUARD_STRICT=1` upgrades the branch warning to a block.
- The pre-commit finds `ca-tools` at `$HOME/.claude/skills/code_assist/bin/ca-tools.js` (override
  with `CA_TOOLS=<path>`); if node/ca-tools is absent it degrades to the branch + message checks.
- Remove with `node bin/ca-tools.js uninstall-git-hooks [dir] --apply` (unsets `core.hooksPath`).
