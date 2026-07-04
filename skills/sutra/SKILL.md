---
name: sutra
description: "Orchestrator for the claude-skills-pack. Use when the user wants the pack's members to cooperate — a commit that also journals and captures a lesson, a review that recalls prior risks, a verify that feeds the memory loop. Sutra owns the unified /sutra:* command surface, the capability registry, the artifact interchange schema, cross-plugin recall, and the verify→lesson→recall feedback loop. It drives code_assist, sb, and unabridged as libraries; the members stay fully standalone without it. Triggers on: 'the whole pack', 'orchestrate', 'commit and capture', 'review with recall', 'bridge these', 'sutra', or any /sutra:<command>."
---

# Sutra — the pack orchestrator

Sutra is the composition root of `claude-skills-pack`. It owns everything *between* the members;
each member (code_assist, sb, unabridged) owns only itself and never references the others. Remove
sutra and every member still works in isolation. Install sutra and the pack becomes one cooperating
system with a single canonical command surface.

**Iron rule: sutra never re-implements a member's logic.** It resolves the member, drives that
member's own router/runner, and layers the cross-plugin bridge steps around it.

## Step 1 — resolve the pack (always first)

```
node ~/.claude/skills/sutra/bin/sutra-tools.js registry
```

This reports each member's `present` / `version` / `capabilities`. Every bridge step below is a
**no-op when its member is absent** — a missing member is never a reason to stop.

## Step 2 — route the request to a /sutra:* command

The command surface mirrors the members' capabilities under one namespace. Three tiers:

| Tier | Commands | What sutra adds |
|---|---|---|
| **Bridged** | `commit review journal plan debug verify adr incident release onboard flow` | pre-`recall` context, post artifact→vault `sync`, `loop-emit`, offer `lesson`, unabridged discipline on full-output steps |
| **Knowledge** | `capture recall sync kanban tasks topic health decision` | code_assist-artifact fusion into the vault |
| **Pass-through** | every other member command (`format github graph notify scan structure* refactor test track secure* search backfill …`) | uniform delegation to the member; full-surface parity |

`/sutra:*` is the **canonical, recommended** surface when the full pack is installed. It does not hide
the members' own `/code_assist:*` and `/sb:*` namespaces — those remain for standalone use.

## Step 3 — execute the wrapper

Each command file in `commands/` is a thin delegator described by `commands/_manifest.json`:
`{ member, router|runner, pre[], post[] }`. To run one:

1. Resolve the target member via the registry (Step 1). If absent, run the pass-through fallback or
   report that the capability needs its member installed.
2. Run any `pre` hooks (e.g. `recall --context "<task>"` to reason WITH prior knowledge).
3. Drive the member's own router/runner — the member's files are the single source of truth for its
   logic. Do NOT duplicate it here.
4. Run any `post` hooks (`sync-artifacts` → vault, `loop-emit` → feedback log, offer `/sutra:capture`).

## What sutra owns (and the members do not)

- **Registry** (`registry/members.json` + `sutra-tools.js registry`) — the only place member presence
  and capabilities are declared. Members never detect each other.
- **Interchange schema** (`schema/*.spec.md` + `sutra-tools.js schema-check`) — the canonical shapes of
  `.journal/`, `docs/adr/`, `.code_review/`. code_assist writes its own format; sutra's conformance
  check catches drift. This lives in sutra so code_assist stays standalone.
- **Bridges** (`bridge/ROUTER.md`) — artifact→vault sync and recall-fusion, described in registry terms.
- **Feedback loop** (`loop/ROUTER.md`) — verify/plan/incident outcomes → `sb` lessons (some tagged
  `risk`) → surfaced again by the next `recall`. Writing out feeds the pull-back.

## The CLI

`bin/sutra-tools.js` is the deterministic backbone (zero-dep, JSON out):
`registry`, `selfcheck`, `bridge status`, `recall --context`, `sync-artifacts <repo>`,
`schema-check <repo>`, `loop-emit --event --note`, `version`. Every command is safe when a member is
absent.

## Rules

- Bridges are additive. If a member is missing, say nothing about it and proceed.
- Never re-implement a member's family logic — drive its router/runner.
- External writes inherited from members (track/notify/github) stay dry-run + confirm.
- Honor the members' own discipline (code_assist's Iron Laws, unabridged's no-truncation).
