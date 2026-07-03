---
name: code_assist/structure/scaffold
description: Create missing canonical files/dirs from templates. Idempotent - never overwrites. Makes a new or partial project structure-compliant.
type: skill
---

# Structure - Scaffold

## Steps
1. Detect language: `node bin/ca-tools.js stack-detect [dir]` (or pass `--lang`).
2. **Dry-run first**: `node bin/ca-tools.js structure-scaffold <dir> --lang <L>` - shows
   `would-create` vs `skip (exists)`. Present it.
3. On confirmation: `... structure-scaffold <dir> --lang <L> --apply`. Creates only missing
   files from `structure/templates/` (README, LICENSE, CHANGELOG, CLAUDE.md, .gitignore,
   .editorconfig, docs/adr/0000-template.md, docs/architecture.md, .github/workflows/ci.yml).
4. **Fill the stubs**: the generated CLAUDE.md/README/architecture are skeletons - seed real
   content (use `onboard` for CLAUDE.md + architecture from the actual code).
5. Re-audit to confirm score improved; persist the profile via `state-write`.

## Rules
- Idempotent: existing files are never overwritten (safe to re-run).
- Language templates are best-effort; the LLM adapts the stub to the real project.
- For a brand-new project, scaffold before writing code so it starts compliant.
