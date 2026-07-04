---
name: code_assist/plan/write
description: Expand an agreed direction into a written, reviewable plan with bite-sized tasks and a verification section. Ends by requesting approval (the HARD-GATE).
type: skill
---

# Plan - Write

Goal: produce `.code_assist/.plan/<slug>.md` following `shared.md`'s structure, then request
approval. This is the gate before execution.

## Prior knowledge (from memory)
`node bin/ca-tools.js recall --context "<the initiative>" --limit 5` - fold relevant lessons into
the Approach and seed the **Risks / open questions** section with any risk `ref`s it returns
(don't rediscover a known pitfall). Proceed if nothing relevant.

## Steps (one todo each)
1. **Context** - capture why this exists (problem, trigger, intended outcome).
2. **Approach** - the single recommended approach; reference concrete files/functions to
   reuse (with paths) from the brainstorm exploration.
3. **Tasks** - decompose into bite-sized, independently verifiable steps. Each names the
   files it touches and is one implement+test+review cycle. Order by dependency
   (infra → models → services → views → tests → docs).
4. **Verification** - exact commands / tests / manual checks that prove the whole thing works.
5. **Risks / open questions** - anything that could force rework; unresolved decisions.
6. **Run a plan-quality self-check** (goal-backward, from GSD): does executing every task
   actually achieve the Context's outcome? Are there gaps? Fix the plan, don't paper over.
7. **Request approval.** Do not proceed to `execute.md` until the user approves. Record
   "Approved <date>" in the plan file on approval.

## Rules
- Include only the recommended approach, not a survey of alternatives.
- Concise enough to scan, detailed enough to execute. Name representative files for repeated
  patterns rather than enumerating every file.
- If the repo uses plan mode (harness), this written plan is the artifact you present.
