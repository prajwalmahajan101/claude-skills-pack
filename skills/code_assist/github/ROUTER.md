---
name: code_assist/github/ROUTER
description: GitHub integration via the gh CLI (no MCP) - read PRs/CI/issues, and (confirm-gated) create PRs / comment. Degrades gracefully if gh is absent.
type: router
---

# GitHub Router

Load `_shared/discipline.md` + `_shared/conventions.md` first.

Uses the `gh` CLI only - no MCP, no extra dependency. Reads run live; writes are
confirm-gated.

| Action | How | Command |
|---|---|---|
| CI status | `node bin/ca-tools.js github ci [--limit N]` | `/code_assist:github` |
| PR list / view | `... github pr [<number>] [--list]` | `/code_assist:github` |
| Issue view | `... github issue <number>` | `/code_assist:github` |
| Create PR | `gh pr create` (confirm first; never auto-push) | `/code_assist:github` |

## Rules
- Reads (`ci`, `pr`, `issue`) run directly and return JSON.
- Writes (`gh pr create`, `gh pr comment`, `gh pr merge`) are outward-facing: show the exact
  command + body and get explicit confirmation before running. Never merge or push unasked.
- If `gh` is not installed/authed, `ca-tools` returns `{ok:false, reason}` - report it and
  fall back to plain `git` where possible.
- Feeds the orchestrator `land` chain (PR after review+verify).
