---
name: sb:emerge
description: Surface emergent patterns across lessons/zettels/topics — clusters notes by shared tag or repeated title token and drafts a verified:false synthesis page in 08_Insights/ for each cluster of 3+ notes lacking one. Dry-run by default; --apply writes. Use to compound scattered notes into higher-order insights.
---

# /sb:emerge

```bash
node ~/.claude/skills/sb/commands/_runners/emerge.js [--apply] [--min N]
```

Deterministic clustering (shared tag / repeated title token); Haiku only names the
pattern and writes the 2-3 sentence synthesis. Each synthesis note is
`type: synthesis`, `verified: false` (visible `[!ai]` callout) in `08_Insights/`,
linking its members, and appears in `synthesis.base` / `unverified.base` until
`/sb:verify`. Dedup is tracked in `_meta/synthesis-seen.json` — re-runs never
duplicate. `--min` sets the cluster-size threshold (default 3). Called by
`/sb:consolidate --apply`. Show output verbatim.
