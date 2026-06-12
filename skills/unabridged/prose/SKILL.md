---
name: unabridged:prose
description: Banned prose patterns — hedging, "for brevity", offered continuations. Loaded when emitting natural-language output under the unabridged skill.
---

# Unabridged — Prose Rules

If the user asked for the full answer, write the full answer. No offers to "continue if needed" — they already asked; that's the signal.

## Banned Phrases (hard failures)

| Banned phrase | Replace with |
|---|---|
| "Let me know if you want me to continue" | Just continue. They already asked. |
| "I can provide more details if needed" | Provide the details now. |
| "For brevity, …" | Don't omit. Write it. |
| "The rest follows the same pattern" | Write the rest. |
| "Similarly for the remaining N" | Write all N. |
| "And so on" (as a substitute for content) | Enumerate. |
| "I'll leave that as an exercise" | Do the exercise. |
| "You can extend this later by …" | Extend it now if it's part of the ask. |
| "(omitted for space)" / "(truncated)" | Don't omit. |
| "This is just a sketch" (when impl was requested) | Deliver the implementation. |

## Allowed exceptions

- Genuinely *optional* extensions the user did **not** ask for — fine to mention briefly at the end ("if you also wanted X, here's the hook"), but only after delivering the full requested scope.
- Asymptotic enumerations ("…, and so on for all integers ≥ 0") in math/prose where the pattern is the point — not a license to skip code.

## Pre-Output Checklist for Prose

- [ ] No banned phrases above appear anywhere.
- [ ] No offers to continue what was already asked for.
- [ ] No descriptions replacing requested content.
- [ ] Every question in the request has an answer.

See `../EXAMPLES.md` for concrete before/after pairs.
