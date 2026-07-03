---
name: code_assist/structure/fix
description: Apply safe structural fixes to bring a repo toward the canonical structure - move loose design docs into docs/, standardize docs/decisions to docs/adr, seed missing governance files. Dry-run first.
type: skill
---

# Structure - Fix

Fixes go beyond scaffolding (creating missing files) into moving/renaming existing content.
These touch real files, so **always dry-run and confirm** before applying.

## Steps
1. `structure audit` first - get the gap list and loose-docs/rename findings.
2. Propose a fix plan (dry-run), each item safe and reversible:
   - **Move loose root design docs** (`HLD.md`/`LLD.md`/`PRD.md`/`RFC*.md`) into `docs/`.
   - **Standardize ADRs**: if `docs/decisions/` exists and `docs/adr/` does not, move it to
     `docs/adr/` (preserve numbering) and update references.
   - **Seed governance**: add missing `CLAUDE.md` (via `onboard`), `LICENSE`, `CHANGELOG.md`,
     `.github/workflows/release.yml`, `.pre-commit-config.yaml`/`.githooks/`.
   - **Flag empty/dead dirs** (do not auto-delete - report for the user to remove).
3. Show the plan; on confirmation apply with `git mv` (preserve history) for moves and
   `structure scaffold --apply` for additions.
4. Re-audit; commit the structural fix as its own `chore:` or `docs:` commit.

## Rules
- Never delete code or dirs automatically - flag empties, let the user decide.
- Use `git mv` so history follows moved files.
- One structural change per commit; do not mix with feature work.
- Respect house-style markers (`.remember/ .planning/ .journal/ .githooks/`) - never "fix" them away.
