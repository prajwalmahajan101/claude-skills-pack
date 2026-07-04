---
name: code_assist/structure/ROUTER
description: Project-structure family - audit a repo against the canonical structure, scaffold missing standard files, or fix structural problems. Backed by ca-tools.js structure-audit/scaffold. code_assist auto-follows the resulting profile.
type: router
---

# Structure Router

Load `_shared/discipline.md` + `_shared/conventions.md`. The canonical structure was derived
from auditing the user's project portfolio; templates live in `structure/templates/`.

| Situation | Load | Command |
|---|---|---|
| Report gaps vs the canonical structure | `audit.md` | `/code_assist:structure` |
| Create missing standard files/dirs | `scaffold.md` | `/code_assist:structure_scaffold` |
| Apply safe structural fixes | `fix.md` | `/code_assist:structure_fix` |

## Canonical structure (summary)
Root: `README.md LICENSE CHANGELOG.md CLAUDE.md Makefile .gitignore .editorconfig`;
`docs/{adr/,architecture.md}`; `.github/workflows/{ci,release}.yml`; `.githooks/` or
`.pre-commit-config.yaml`. Per language:
- **Python**: `src/<pkg>/{api,service,repository,model,core} · tests/{unit,integration,e2e} · pyproject.toml`.
- **Go**: `cmd/<bin>/ · internal/ · pkg/ · test/{e2e,chaos} · .golangci.yml · .goreleaser.yaml`.
- **Rust**: workspace `Cargo.toml · crates/ · rustfmt.toml + clippy`.
- **JS/TS**: `src/ · tests/ · package.json (lint/format/typecheck/test)`.
- **Polyglot**: per-stack subdirs + `shared/{contract,openapi}` seam + unifying root files.

## House-style markers to PRESERVE (never delete)
`.remember/ .planning/ .journal/ .githooks/ docs/adr/` - the portfolio's existing
conventions. Design docs belong under `docs/`, not the repo root. Standardize ADRs on
`docs/adr/` (flag `docs/decisions/`).

## Auto-follow
After audit/scaffold, persist the profile:
`node bin/ca-tools.js state-write --key structure_profile --value <python-service|go|...>`.
`onboard`, `plan`, and the orchestrator consult it so all actions respect the structure.

## Execution Mode - Agent Dispatch
For a large or unfamiliar repo, delegate to the **`ca-structure-auditor`** subagent
(`subagent_type: ca-structure-auditor`, pass `repo` + `mode`). It runs the audit + onboard-scan
and returns a compact scaffold/fix plan without loading the repo into the main context. Applying
the plan (scaffold/`git mv`) stays in the main session, after confirmation.

## Grounding
`node bin/ca-tools.js structure-audit [dir]` and `structure-scaffold <dir> [--lang L] [--apply]`
do the exact detection and file creation. The LLM decides which fixes are safe.

> **Bridge:** `structure scaffold` honors `unabridged` (real files, no placeholders) when it is installed. See `bridge/ROUTER.md`.
