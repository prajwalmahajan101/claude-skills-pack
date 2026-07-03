---
name: sb:eval
description: Measure retrieval quality of the sb lexical retriever — recall@1/3/5/10 + MRR per note-type over a held-out, Haiku-paraphrased question set. Use to check whether /sb:ask, /sb:recall, and /sb:search are actually surfacing the right notes.
---

# /sb:eval

```bash
node ~/.claude/skills/sb/commands/_runners/eval.js [--rebuild] [--sample N]
```

Builds a cached question set (`_meta/eval-set.json`) — one paraphrased question per
sampled lesson/topic/zettel/insight/decision, with the note's own title words banned
so the question tests real recall — then scores the retriever against it.

- `--rebuild` regenerates the question set (needs the `claude` CLI + Haiku).
- `--sample N` controls how many notes are sampled when building (default 12).

Results cache to `_meta/eval-results.json`; `/sb:status` surfaces the latest recall@5.
Show output verbatim.
