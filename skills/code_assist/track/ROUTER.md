---
name: code_assist/track/ROUTER
description: Issue-tracker integration (Jira first; tracker-agnostic shape). Read an issue as context; comment / transition tickets confirm-gated. Reads env tokens; no MCP.
type: router
---

# Track Router

Load `_shared/discipline.md` first.

Thin REST client in `ca-tools.js` (no MCP). Configured via env:
`JIRA_BASE_URL` + `JIRA_EMAIL` + `JIRA_TOKEN`. No tokens -> commands no-op with a setup hint.
The same shape extends to Linear / GitHub Issues adapters.

| Action | How | Notes |
|---|---|---|
| Fetch issue (context) | `node bin/ca-tools.js track get <KEY>` | read, live |
| List transitions | `... track transitions <KEY>` | read, live |
| Comment on issue | `... track comment <KEY> --text "..." [--confirm]` | **write** |
| Transition issue | `... track transition <KEY> --to <id> [--confirm]` | **write** |

## Rules
- **Writes are dry-run by default**: without `--confirm`, `ca-tools` returns the exact
  endpoint + payload it *would* POST. Show it, get confirmation, then re-run with `--confirm`.
- Use `get` to seed `plan`/`journal` context from a ticket (orchestrator `start` chain).
- Link a branch to an issue by key in the branch name and in `.code_assist/config.json`
  (`state-write --key jira_project`).
- Never transition or comment automatically inside another flow without a confirm.
