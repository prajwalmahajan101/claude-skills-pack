# Interchange schema — code review

**Producer:** code_assist `code_review` family · **Consumer:** sb vault (review history + open-issue
surfacing in the project INDEX).

Sutra owns this contract. code_assist writes its own review state standalone; sutra's `schema-check`
asserts that output still matches this spec, and sutra's `sync-artifacts` parses issues by it.

## Location & files
- Review state lives at `<repo_root>/.code_review/` (flat, single-stack) or
  `<repo_root>/.code_review/<stack>/` (fullstack). The state files are:
  `code_review_issues.md`, `code_review_history.md`, `learning.md`, `architecture_map.md`
  (+ a top-level `SUMMARY.md` for fullstack).
- The interchange-critical file is **`code_review_issues.md`** — the active issue tracker.

## Required structure of `code_review_issues.md`
Each issue is a block:
1. An issue header, in either form:
   - **Block (canonical):** `### ISSUE-NNN — <short title>` (`ISSUE-` + zero-padded number).
   - **Inline (recognized alternative):** `ISSUE-NNN | <Severity> | <Priority> | …` on a single line,
     carrying the metadata inline.
   The header id must sit at the start of a line (after optional heading/list/quote markup); an
   `ISSUE-NNN` mentioned in prose is not a header. A header inside a fenced code block (` ``` `/`~~~`)
   is a snippet, not a real issue, and is ignored.
2. A metadata line (or inline header) carrying at least Severity and Priority:
   `` `Severity: Critical|High|Medium|Low` · `Priority: P0|P1|P2|P3` · `Effort: S|M|L` · `Category: …` ``
   Severity ∈ {Critical, High, Medium, Low}; Priority ∈ {P0, P1, P2, P3}.
3. Resolved issues appear under a trailing `## Resolved` section; the active parser stops there.

Both header forms and the fence/prose exclusions are defined once, in `lib/artifacts.js`
(`parseIssues`); `schema-check`'s `checkReviews` reuses that same tokenizer so conformance and vault
ingest can never disagree on what an issue is.

## Conformance
`schema-check` reports the review state as **conforming** when `code_review_issues.md` exists and every
active `### ISSUE-NNN` block (before `## Resolved`) has a parseable Severity + Priority. An issue block
missing a valid Severity/Priority is a violation (error). Absence of `.code_review/` entirely is "not
found" (not a violation).
