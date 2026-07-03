---
name: code_assist/structure/audit
description: Report a repo's gaps vs the canonical project structure - missing standard files, ADR-naming split, loose root design docs, empty dirs - with a compliance score.
type: skill
---

# Structure - Audit

## Steps
1. Run `node bin/ca-tools.js structure-audit [dir]` (default `.`). It returns detected
   languages/stacks, required markers, gaps (error/warn), loose root design docs, empty flag,
   and a compliance score.
2. **Report** the gaps grouped by severity. For each, state the canonical fix and which
   `structure` action addresses it (scaffold vs fix).
3. Call out the recurring portfolio problems when present: missing `CLAUDE.md`/`LICENSE`,
   `docs/decisions/` instead of `docs/adr/`, HLD/LLD/PRD loose at root, uneven release CI.
4. Persist the profile for auto-follow:
   `node bin/ca-tools.js state-write --key structure_profile --value <profile>`.

## Rules
- Read-only. Never modify the repo in `audit` - recommend `scaffold`/`fix` instead.
- `soft`/`warn` gaps are advisory (e.g. `src/` layout); `error` gaps are real omissions.
