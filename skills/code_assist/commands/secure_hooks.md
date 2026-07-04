---
name: code_assist:secure_hooks
description: Install code_assist guardrails as real git hooks (secret-scan + Conventional-Commit lint on every commit, outside Claude Code too). Triggers on "install git hooks", "pre-commit hook", "enforce commits at git layer", "commit-msg lint".
---

# /code_assist:secure_hooks

Read `~/.claude/skills/code_assist/secure/git-hooks.md` and follow it - preview with
`install-git-hooks`, then `--apply` to write `.githooks/` + set `core.hooksPath`. The hooks run the
same rules as the `ca-git-guard` Claude hook, so behavior is identical in and out of a session.
