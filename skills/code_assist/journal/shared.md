---
name: code_assist/journal/shared
description: Shared rules, template structure, and journal location conventions for the journal sub-skill
type: shared
---

# Journal — Shared Rules & Conventions

This file is included by `new.md` and `update.md`. Read it before executing either.

---

## Journal Location

Journal entries live at `<repo_root>/.journal/`. Entry files are named `M<phase>.md` (e.g. `M1.2.md`, `M2.0.md`). The template lives at `<repo_root>/.journal/TEMPLATE.md`.

Discovery:

1. Resolve repo root: `git rev-parse --show-toplevel`.
2. If `<root>/.journal/TEMPLATE.md` exists, use it as the structure source of truth.
3. If `.journal/` does not exist, ask the user before creating it. Do not create it silently.
4. If `TEMPLATE.md` is missing but `.journal/` exists, fall back to the canonical structure below.

---

## Canonical Template Structure

Every journal entry mirrors `TEMPLATE.md`. The canonical sections, in order:

1. **Header** — `# M<phase> journal — <one-line phase title>`
2. **Branch / Goal / Plan** — three bold-prefixed lines:
   - `**Branch:** \`<branch-name>\` off \`main@<sha>\``
   - `**Goal:** <goal>`
   - `**Plan:** <link or one-line note>`
3. `## What I did` — decisions ratified + atomic commits shipped, 6–12 factual bullets.
4. `## Problems I faced` — bugs, false starts, dead ends, library quirks. One paragraph per problem.
5. `## What could have been done better` — calibration, not blame.
6. `## Changes carried back to earlier phases` — refactors of earlier work; write `none` explicitly if untouched.
7. `## What's next` — two bulleted sub-points:
   - `**Hand-off to next phase**` — open questions for the immediate next milestone.
   - `**v2 carry-list**` — known deferrals, profiler-bait, accepted trade-offs.
8. `## Journal` — chronological free-form dev log, written as the phase happens.

If the project's `TEMPLATE.md` diverges from this list, **the project's template wins**. Read it and mirror its structure exactly.

---

## Content Rules

- **Factual, not promotional.** "What I did" lists what shipped; it is not a retrospective and not a sales pitch.
- **Honest "Problems I faced".** Surface dead ends and library quirks with enough detail that future-you recognises the same shape if it recurs. One paragraph per problem.
- **No blame in retrospectives.** Frame "What could have been done better" as calibration.
- **Explicit `none`** when a section genuinely has nothing — never leave it blank.
- **Cite commits** by SHA (short or full) when referencing what shipped. Use `git log --oneline <base>..HEAD` to gather them.
- **Reference ADRs, plans, issues by path or number** rather than re-explaining their contents.

---

## Phase Identifier

The phase identifier (`M1.2`, `M2`, etc.) determines the filename. Discovery order:

1. User-supplied argument (e.g. `/code_assist:journal M1.5`).
2. Current git branch name if it encodes a phase (`m1.5-…`, `phase/1.5-…`).
3. Most recently modified file in `.journal/` minus `TEMPLATE.md` — assume the user is updating the current phase.
4. Ask the user.

---

## Global Rules

- **Never overwrite an existing journal entry without confirmation.** Append or edit; do not blow away prior content.
- **Never invent commits, branches, or shas.** Everything in the header lines and "What I did" must trace to `git log`/`git status`.
- **Never leak secrets.** If a commit message or diff references env vars, credentials, or tokens, summarise without quoting the secret.
- **Keep prose tight.** Bullets short; paragraphs one-problem-each. The journal is a working document, not an essay.
