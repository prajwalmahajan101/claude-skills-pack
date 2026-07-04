---
name: sutra/loop/ROUTER
description: The pack's closed feedback loop — verify/plan/incident outcomes become sb lessons that the next recall surfaces. Hub-owned because the loop is inherently cross-plugin; the emit points live inside the member families, sutra wires them together.
type: router
---

# Feedback Loop Router

The pack learns across sessions. Outcomes flow one way, knowledge flows back the other:

```
verify / plan / incident outcome
        │  loop-emit
        ▼
   .sutra/loop.jsonl  ──promote──▶  sb lesson (some tagged `risk`)
                                          │
                                          ▼  recall
                          surfaced next time by /sutra:{plan,review,debug,verify}
```

## Emitting an outcome

After a proven `verify`, a resolved `plan`, or an `incident` postmortem, record the durable takeaway:

```
node ~/.claude/skills/sutra/bin/sutra-tools.js loop-emit --event <verify|plan|incident> \
     --note "<what was learned / what to watch>" [--risk]
```

`--risk` marks the event so recall prioritizes it as a risk lead. The event is appended to
`<repo>/.sutra/loop.jsonl` (durable, git-ignorable).

## Promoting to a lesson

When sb is present, offer to promote the event into the vault so it becomes first-class, searchable
knowledge:

```
/sutra:capture "<title>"      # drives sb's lesson runner with the loop note as seed
```

Lessons tagged `risk` are exactly what the **reverse channel** (`bridge/ROUTER.md` Handoff 0) pulls
back into the next design/review/debug. Writing out *feeds* the pull-back — that is the loop.

## Rule

The loop is additive. The emit points are inside the member families (verify/plan/incident); sutra only
sequences and persists. If sb is absent, the event still lands in `.sutra/loop.jsonl` — nothing is lost;
it just is not promoted to the vault until sb is installed.
