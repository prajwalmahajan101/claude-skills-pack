---
name: code_assist/journal/ROUTER
description: Routes between creating a new journal entry and updating an existing one based on user intent and on-disk state
type: router
---

# Journal Router

Pick exactly one sub-skill and follow it. Do not duplicate its logic here.

## Routing Table

| Trigger phrases / state | Sub-skill file |
|---|---|
| "start journal", "new journal", "create entry", "open phase", no `M<phase>.md` exists yet | `new.md` |
| default - "journal this", "log this", "update journal", "ratify", "close out", `M<phase>.md` already exists | `update.md` |

## How to Use

1. Confirm you are inside a git repository (`git rev-parse --is-inside-work-tree`). If not, tell the user and stop.
2. Resolve the target entry path per `shared.md` → Phase Identifier.
3. If the file does **not** exist → use `new.md`.
4. If the file **does** exist → use `update.md` (unless the user explicitly asks for a fresh entry; then confirm before overwriting).
5. Read `/home/prjawal/.claude/skills/code_assist/journal/shared.md` for template structure and global rules.
6. Read the chosen sub-skill file and execute it exactly.

Both sub-skills inherit the rules in `shared.md`.

---

## Optional: Agent Dispatch

You may delegate to the `journal-writer` subagent instead of running the sub-skill inline. Useful when:

- The diff and commit history are large and you want them out of the main session.
- The user invoked `/code_assist:journal` without further conversation context to preserve.

**When NOT to delegate:**
- The user is mid-conversation describing a problem they hit - that prose is the journal content and lives in the main session. Capture it inline.
- Quick single-line `## Journal` appends - agent overhead isn't worth it.

**How to delegate:**

Spawn the agent in a single Agent tool call:
- `subagent_type: journal-writer`
- `description`: e.g. `"Seed journal entry for M1.5"` or `"Append shipped commits to M1.5 journal"`
- `prompt`: pass through `mode` (`new` | `update`), `phase` (e.g. `1.5`), and any `scope_hint` (goal text, section to update, paragraph the user dictated).

When the agent returns its short confirmation, relay it to the user verbatim.

> **Note:** the entry is written under `.journal/` (git-tracked).
