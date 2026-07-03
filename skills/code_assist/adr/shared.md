---
name: code_assist/adr/shared
description: ADR template and conventions (Context/Decision/Consequences/Usage) shared by new/supersede/index.
type: shared
---

# ADR - Shared Template & Rules

## Template (`docs/adr/NNNN-<slug>.md`)
```markdown
# NNNN. <title>

- Status: proposed | accepted | superseded by [NNNN](NNNN-….md)
- Date: <YYYY-MM-DD>

## Context
The forces at play — why this decision is needed now, constraints, requirements.

## Decision
What we decided, stated plainly and actively ("We will …").

## Consequences
What becomes easier and harder; trade-offs; follow-on work; risks accepted.

## Usage
How future work should apply this decision (the practical rule it sets).
```

## Rules
- One decision per ADR. Immutable once accepted - to change a decision, write a NEW ADR that
  supersedes it (never rewrite history).
- Keep the project `CLAUDE.md` holding only an ADR *index* (one line each), not bodies.
- Standardize on `docs/adr/`. Numbering is zero-padded and monotonic.
- Use `node bin/ca-tools.js graph impact <symbol>` to ground the Consequences section in the
  real blast radius when the decision touches existing code.
