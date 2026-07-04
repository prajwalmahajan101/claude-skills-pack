# Interchange schema — journal

**Producer:** code_assist `journal` family · **Consumer:** sb vault (`sync` → project journal notes).

Sutra owns this contract. code_assist writes its own journal format standalone; sutra's
`schema-check` asserts that output still matches this spec so drift is caught here, not silently.

## Location & filename
- Journal entries live at `<repo_root>/.journal/`.
- Entry files are named `M<phase>.md` where `<phase>` is a dotted version (`M1.md`, `M1.2.md`, `M2.0.md`).
  Regex: `^M[0-9]+(\.[0-9]+)*\.md$`.
- `TEMPLATE.md` is **not** an entry and is excluded.

## Required structure (what the interchange depends on)
1. A single H1 header on the first non-empty line: `# M<phase> journal — <title>` (the `— <title>` is
   recommended; the `# M<phase>` prefix is required so the phase is recoverable from the body).
2. Non-empty body content below the header.

## Recommended sections (from the canonical template; validated as warnings, not errors)
`## What I did`, `## Problems I faced`, `## What could have been done better`,
`## Changes carried back to earlier phases`, `## What's next`, `## Journal`.

A project's own `.journal/TEMPLATE.md` may override the section set; the H1 + phase rule always holds.

## Conformance
`schema-check` reports a journal as **conforming** when the filename matches and the H1 phase header is
present with non-empty content. Missing recommended sections are warnings.
