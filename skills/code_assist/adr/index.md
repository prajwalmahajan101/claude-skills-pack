---
name: code_assist/adr/index
description: Rebuild the ADR index (docs/adr/INDEX.md) and the one-line ADR index in the project CLAUDE.md.
type: skill
---

# ADR - Index

## Steps
1. **List** all `docs/adr/NNNN-*.md` (exclude `0000-template.md`), sorted by number.
2. **Extract** each ADR's number, title, status, and date (from its header).
3. **Write `docs/adr/INDEX.md`**:
   ```markdown
   # Architecture Decision Records

   | # | Title | Status | Date |
   |---|---|---|---|
   | [0001](0001-….md) | … | accepted | YYYY-MM-DD |
   ```
4. **Sync the CLAUDE.md ADR index** (if the project `CLAUDE.md` has an ADR section): one
   line per ADR (number + title + status), bodies stay in `docs/adr/`.

## Rules
- Index is generated - do not hand-edit; re-run this to refresh.
- Superseded ADRs remain listed with their superseded status.
