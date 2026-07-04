---
name: code_assist/adr/ROUTER
description: Routes architecture-decision-record work to new, supersede, or index. Standardizes on docs/adr/ with the Context/Decision/Consequences/Usage template.
type: router
---

# ADR Router

Load `_shared/discipline.md` + `_shared/conventions.md`. ADRs live in **`docs/adr/`** (standardize; if the repo uses
`docs/decisions/`, keep writing there but note the split for `structure fix`).

| Situation | Load | Command |
|---|---|---|
| Record a new architectural decision | `new.md` | `/code_assist:adr` |
| Replace an existing decision | `supersede.md` | `/code_assist:adr_supersede` |
| Rebuild the ADR index | `index.md` | `/code_assist:adr_index` |

## When to write an ADR
Before (or as part of) a non-trivial architectural change: new service, schema migration,
protocol change, dependency swap, cross-cutting pattern. If the decision isn't recorded,
draft the ADR as part of the plan.

## Numbering
`docs/adr/NNNN-<slug>.md`, zero-padded, incrementing from the highest existing number.
`docs/adr/0000-template.md` is the template (created by `structure scaffold` if missing).

> **Note:** the ADR is written under `docs/adr/` (git-tracked).
