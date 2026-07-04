# ADR 0002: Sutra orchestrator + full plugin independence

- **Date:** 2026-07-04
- **Status:** Accepted

## Context

The pack shipped three plugins — `code_assist`, `sb`, `unabridged` — that were code-independent (no
cross-plugin imports) but not *responsibility*-independent. `code_assist` carried baked-in knowledge of
its siblings: a `bridge/` family, hardcoded `existsSync(~/.claude/skills/sb)` detection, a `recall` that
fused sb's vault, and ~15 files of "**Bridge:**" handoff prose. `sb` read `code_assist`'s in-repo
artifacts (`.journal/`, `.code_review/`) via `lib/repo-artifacts.js`. The members knew about each other
— a Single-Responsibility violation that made each harder to reason about and ship standalone.

We wanted two install modes: à-la-carte members (maximum isolation) and a full cooperating pack.

## Decision

Extract **all** cross-plugin logic into a new 4th plugin, **`sutra`** ("holder of the threads"), the
composition root. Locked choices:

1. **Members are fully standalone.** Remove sutra and no member references any other (verified by grep).
   `code_assist` loses its `bridge/` family, sibling detection, and sb-fusion; its `recall` keeps only
   the three harness stores. `sb` loses `repo-artifacts.js`; its repo-mirroring becomes a generic,
   producer-agnostic `ingest` primitive. `unabridged` was already independent.
2. **Sutra owns the seams:** a data-driven capability **registry** (inverting the hardcoded detection —
   members never name each other), the artifact **interchange schema** + a conformance check (so
   `code_assist` stays ignorant of it yet drift is caught), the **bridges** (`sync-artifacts`, fused
   `recall`), and the **feedback loop** (`verify`/`plan`/`incident` → `loop-emit` → sb lesson → next
   `recall`).
3. **Wrapper owns the canonical surface, realized as a general agent + composed commands.** `/sutra:do`
   dispatches any request to a general `sutra-agent` that knows the whole ecosystem; Tier-1 commands
   (`review`, `commit`, `verify`, `recall`, `sync`, `capture`) pre-wire common composed flows. The
   surface is **canonical, not exclusive** — Claude Code cannot hide the members' own namespaces, and
   they remain for standalone use. This replaces the plan's 81 rigid stubs.
4. **Graph-grounded reviews stay inside `code_assist`.** Since `review` and `graph` are both its
   capabilities, composing them is code_assist-internal: a new deterministic `graph review-prep`
   produces a blast-radius table so severity is grounded, not guessed. Sutra adds only the cross-plugin
   legs (recall + sb).

## Consequences

Each member is simpler and independently shippable; sutra is a thin, optional composition layer that
no-ops every bridge when a member is absent. The interchange schema is owned in one place with a
conformance test guarding drift. Cost: cross-plugin behavior now requires installing sutra; the schema
contract lives in sutra rather than the producer (reconciled via a conformance test, not a code
dependency). The general-agent surface trades exhaustive per-command stubs for one intelligent router —
more capable and far more maintainable, at the price of less rigid per-command declarations.

## Usage

- Add cross-plugin behavior only in `sutra` (registry, bridges, schema, commands). Never make a member
  reference a sibling — if you need one to know about another, that knowledge belongs in the registry.
- When a member changes an artifact format, update `sutra/schema/*.spec.md` + its conformance fixture
  together; the schema-check test enforces the contract.
- New members join by adding a `registry/members.json` entry (+ wrapper commands), not by editing peers.
