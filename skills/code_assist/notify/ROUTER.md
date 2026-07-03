---
name: code_assist/notify/ROUTER
description: Send notifications to Slack or Telegram via webhook. Confirm-gated; reads env config; no MCP. Used to announce long-running review/CI/release completion.
type: router
---

# Notify Router

Webhook POST from `ca-tools.js`. Config via env:
- Slack: `SLACK_WEBHOOK_URL`.
- Telegram: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.

| Action | How |
|---|---|
| Slack message | `node bin/ca-tools.js notify slack --text "..." [--confirm]` |
| Telegram message | `node bin/ca-tools.js notify telegram --text "..." [--confirm]` |

## Rules
- **Sending is outward-facing** - dry-run by default (returns the payload it *would* POST).
  Show it, confirm, then re-run with `--confirm`.
- No webhook/token set -> no-op with a setup hint. Never block on it.
- Keep messages short and factual (what completed, result, link). Used by the orchestrator
  `ship` chain to announce a shipped commit / PR.
