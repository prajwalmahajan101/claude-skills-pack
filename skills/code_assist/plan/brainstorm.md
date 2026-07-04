---
name: code_assist/plan/brainstorm
description: Explore intent and design space before any plan or code. Interview the user, surface approaches and trade-offs, converge on a direction to hand to write.md.
type: skill
---

# Plan - Brainstorm

Goal: turn a fuzzy request into a clear, agreed direction. No code, no file edits (beyond
scratch notes in `.code_assist/.plan/`).

## Prior knowledge (from memory)
Before exploring, pull what the pack already learned so you design WITH it, not around it:
`node bin/ca-tools.js recall --context "<the initiative in a few words>" --limit 5`. Lead with any
**risks** it returns (approaches to avoid, past regressions), fold relevant lessons into the
options, and cite the `ref` when you lean on one. If nothing relevant returns, proceed.

## Steps (one todo each)
1. **Restate the intent** in your own words; confirm the real problem and the desired
   outcome. If the ask is a solution, dig for the underlying need.
2. **Explore the codebase** for existing patterns/utilities to reuse (`ca-tools stack-detect`,
   `graph query`, Grep). Prefer reuse over new abstractions.
3. **Surface 2-3 approaches** with honest trade-offs (simplicity vs performance vs
   maintainability; minimal-change vs clean-architecture). Recommend one and say why.
4. **Interview edge cases** - failure modes, data shapes, scale, security boundaries,
   backward-compat. Ask the user only what you genuinely cannot decide from the code.
5. **Converge**: write a short direction note to `.code_assist/.plan/<slug>.md` (Context +
   chosen Approach). Hand off to `write.md` to expand into tasks.

## Rules
- Ask before assuming on anything that changes the outcome; otherwise pick the sensible
  default and state it.
- Do not start implementation. This phase ends by producing an agreed direction, not code.
- If the work is trivial and unambiguous, say so and skip straight to a 2-line plan.
