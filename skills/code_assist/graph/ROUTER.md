---
name: code_assist/graph/ROUTER
description: Code-intelligence family - gitnexus call-graph (context, impact/blast-radius, detect-changes) and graphify knowledge-graph (query, report). Feeds review, debug, and onboard. Degrades gracefully if the tools are absent.
type: router
---

# Graph Router

Wraps two optional external CLIs via `ca-tools.js graph`:
- **gitnexus** - call/execution graph over the repo (structural code intelligence).
- **graphify** - knowledge graph over any input (code/docs) with a plain-language report.

| Action | How | Use |
|---|---|---|
| Tool availability | `node bin/ca-tools.js graph status` | check first |
| Index the repo | `... graph index [dir]` | one-time / on big changes |
| Symbol 360 view | `... graph context <symbol>` | callers/callees/processes |
| Blast radius | `... graph impact <symbol>` | what breaks if you change it |
| Diff -> affected flows | `... graph detect-changes` | map staged diff to symbols/flows |
| Ask the graph | `... graph query "<concept>"` | find execution flows |

## Where it plugs in
- **review**: run `graph impact` on changed symbols to size blast radius; `detect-changes`
  to flag which flows a diff touches (informational input to the review scorecard).
- **debug**: `graph context <symbol>` for callers/callees around a failure.
- **onboard**: `graph index` + `graphify` report to build the architecture map + CLAUDE.md.
- **adr**: `graph impact` to ground the Consequences (blast radius) section.

## Rules
- Read-only analysis (indexing writes only to the tool's own cache).
- If neither tool is installed, `ca-tools` reports it - fall back to Grep-based exploration.
- Indexing can be slow on large repos; run `graph index` once, then reuse.
