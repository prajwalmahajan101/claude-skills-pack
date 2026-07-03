---
name: code_assist/adr/supersede
description: Supersede an existing ADR with a new decision, updating both records' status links.
type: skill
---

# ADR - Supersede

## Steps
1. **Identify the ADR being replaced** (`docs/adr/NNNN-*.md`). Read it.
2. **Write a new ADR** (`adr/new.md` flow) whose Context references what changed since the
   old decision. Its Status is `accepted`.
3. **Update the old ADR's Status** to `superseded by [MMMM](MMMM-<slug>.md)` - do NOT delete
   or rewrite its body (decisions are immutable; the trail matters).
4. **Cross-link**: the new ADR notes "Supersedes [NNNN](NNNN-<slug>.md)".
5. **Rebuild the index** (`adr_index`) and update the `CLAUDE.md` ADR index line.

## Rules
- Never erase the superseded decision - future readers need to know what changed and why.
