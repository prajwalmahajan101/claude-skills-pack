---
name: sutra:do
description: Do anything across the whole pack. Dispatches a free-form request to the general sutra orchestrator agent, which resolves which members are present and composes code_assist + sb + unabridged (with recall, graph-grounding, vault capture, and the feedback loop) to accomplish it. Triggers on "sutra do", "orchestrate", "handle this across the pack", "/sutra:do <anything>".
argument-hint: <any request — e.g. "ship this branch", "review and capture lessons", "debug the failing test">
allowed-tools:
  - Task
  - Bash
  - Read
---

# /sutra:do

Run **any** request through the whole pack. This is the catch-all, composed entrypoint.

## Steps

1. Confirm the ecosystem: `node ~/.claude/skills/sutra/bin/sutra-tools.js registry` (which members are present).
2. Launch the **`sutra-agent`** subagent (via the Task tool) with the user's request:

   **Request:** `$ARGUMENTS`

   The agent knows the entire ecosystem — the registry, every member's capabilities, the bridges
   (`recall`, `sync-artifacts`, `loop-emit`, `schema-check`, `graph review-prep`), and the feedback
   loop. It resolves owners, drives each member's own router/runner, and wires the cross-plugin
   bridges around them. It never re-implements a member's logic.

3. Relay the agent's result chain to the user (e.g. "recall → review (graph-grounded) → synced 3
   notes → captured 1 lesson").

## Notes

- If a request maps cleanly to one composed flow, prefer the dedicated command instead
  (`/sutra:review`, `/sutra:commit`, `/sutra:capture`, `/sutra:recall`, `/sutra:sync`) — they are the
  same composition, pre-wired. `/sutra:do` is for open-ended or multi-step requests.
- Every bridge step no-ops when its member is absent; the agent proceeds with what is installed.
