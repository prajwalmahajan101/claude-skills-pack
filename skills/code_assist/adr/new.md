---
name: code_assist/adr/new
description: Draft and record a new ADR from a decision made in this session.
type: skill
---

# ADR - New

## Steps
1. **Ensure `docs/adr/` exists** (and `0000-template.md`); if not, `structure scaffold` it.
2. **Determine the next number** - highest `NNNN-*.md` + 1, zero-padded.
3. **Draft** the ADR from `shared.md`'s template. Fill Context / Decision / Consequences /
   Usage from the actual decision and its discussion. For Consequences touching existing
   code, run `graph impact <symbol>` to state real blast radius.
4. **Write** `docs/adr/NNNN-<slug>.md` with Status `accepted` (or `proposed` if not yet
   agreed).
5. **Update the index** (`adr_index`) and add a one-line entry to the project `CLAUDE.md`
   ADR index if present.
6. Optionally mirror to the sb vault (`11_Decisions`) if configured.

## Rules
- One decision per file. Plain, active Decision statement.
- Do not invent rationale - if Context/Consequences are unknown, ask or mark them explicitly.
