---
name: sb:distill
description: Distill a note into atomic, source-anchored claims — each claim cites the numbered source block it came from; unsourced claims are dropped and reported. Writes a verified:false distillation note to 08_Insights/ with sources preserved verbatim. Use to compress a long lesson/topic into traceable facts.
---

# /sb:distill

```bash
node ~/.claude/skills/sb/commands/_runners/distill.js "<note-path-or-slug>"
```

Numbers the source note's blocks `B1..Bn`, has Haiku extract atomic claims each
tagged `(src: Bn)`, then keeps only claims that cite a real block and lists the
rest under **Dropped (unsourced)**. The output note is `type: distillation`,
`verified: false` (visible `[!ai]` callout) and appears in `unverified.base` until
`/sb:verify`. Needs the `claude` CLI + Haiku. Show output verbatim.
