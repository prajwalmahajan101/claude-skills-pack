---
name: code_assist/onboard/ROUTER
description: Onboard to an unfamiliar repo - build an architecture map and seed a project CLAUDE.md from the actual code, using code-intelligence (gitnexus/graphify) and structure detection. Single-purpose family.
type: router
---

# Onboard

Goal: make an unfamiliar (or under-documented) repo legible - produce `CLAUDE.md` and
`docs/architecture.md` grounded in the real code, and set the structure profile.

## Steps (one todo each)
1. **Detect** shape: `node bin/ca-tools.js stack-detect` + `structure-audit` (languages,
   stacks, gaps, compliance score).
2. **Map the code**: `node bin/ca-tools.js graph index` then `graph query "<entry point>"`
   / `graphify` for a knowledge-graph report. Fall back to Grep/Glob if the tools are absent.
   Identify entry points, top-level modules, the request/data flow, and boundaries.
3. **Write `docs/architecture.md`** from the template (Overview / Components / Data flow /
   Boundaries / Cross-cutting), filled from what you found - not guesses.
4. **Seed `CLAUDE.md`** from the template: tech stack, real build/test/lint commands (read
   them from Makefile/package.json/pyproject), non-obvious conventions, known gotchas, and an
   ADR index link. Offer before overwriting an existing CLAUDE.md.
5. **Persist the profile**: `state-write --key structure_profile --value <profile>` so other
   families auto-follow it.
6. **Report** a short orientation: entry points, how to run/test, where the important code lives.

## Rules
- Ground every claim in the code (cite `path:line`). Do not invent architecture.
- Never overwrite an existing CLAUDE.md/README without asking; prefer augmenting.
- Chains from `structure scaffold` (seed the stubs, then fill them here).
