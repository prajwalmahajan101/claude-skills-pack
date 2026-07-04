# Known Issues

Tracked defects surfaced by the fresh-eyes audit that are **not yet fixed**. Each entry is
`file:line` evidence, impact, and a suggested fix. Remove an entry when its fix lands (with a
regression test). Severity: **H** = High, **M** = Medium, **L** = Low; `(test-gap)` marks a
missing-coverage risk rather than a live bug.

## Open

### H1 — sutra: two divergent issue parsers

- **Where:** `skills/sutra/lib/artifacts.js:116` vs `skills/sutra/bin/sutra-tools.js:164`
- **Issue:** `parseIssues` accepts both the inline (`ISSUE-001 | High | P1`) and H3-block
  (`### ISSUE-001 — title`) forms; `checkReviews` accepts H3 only. An inline-form issues file
  therefore passes conformance **unvalidated** while `sync-artifacts` still ingests it. Two code
  paths sutra owns produce contradictory views of the same file, undermining sutra's
  single-source-of-truth guarantee.
- **Fix:** share one tokenizer — have `checkReviews` call `artifacts.parseIssues` (or extract a
  common `isIssueHeader`/`parseIssues`) so "what is an issue" is defined once. If the inline form is
  intentionally supported, document it in `review.spec.md`.

### H2 — sutra: issue parsers ignore fenced code blocks

- **Where:** `skills/sutra/lib/artifacts.js:119-134`, `skills/sutra/bin/sutra-tools.js:232-244`
- **Issue:** neither loop tracks ` ``` ` fence state, so a `### ISSUE-999` inside a fenced code
  block is treated as a real header — fabricating phantom open issues in the vault and false-positive
  conformance violations. The `302c422` id-anchoring fix guarded prose mentions but not code fences.
- **Fix:** track ` ``` ` fence state in both loops and skip lines inside fences.

### H3 — sb: unlocked, non-atomic frontmatter update

- **Where:** `skills/sb/lib/markdown.js:123-137`
- **Issue:** `updateFrontmatter` does `readFileSync` → parse → `writeFileSync` with no lock and no
  atomic temp-rename (unlike `vault.js` `writeJSON`). Three auto-firing hooks
  (`sb-plan-mirror.js`, `sb-capture.js`, `markSessionEnded`) mutate the same conversation file, so
  interleaved writes clobber each other — lost `plans`/`turn_count`, and a torn write on crash.
- **Fix:** route `updateFrontmatter` through an atomic temp-rename and a per-file lock (mirror
  `writeJSON`), or funnel all frontmatter mutations for a note through a single locked helper.

### H4 (test-gap) — sb: untested recursive vault delete + migrators

- **Where:** `skills/sb/bin/sb-vault-repair.js:191-192` (plus `:170`, `:176`) and the slug/folder
  migrators
- **Issue:** `fs.rmSync(..., { recursive: true, force: true })` force-deletes vault scope
  directories, and the migrators rename notes, with **zero tests**. A scope-computation bug would
  force-delete the wrong directory in the user's second brain. Manual / `--apply`-only path (not the
  auto-firing capture hot-path), which caps likelihood but not blast radius.
- **Fix:** dry-run vs `--apply` subprocess tests against a temp vault asserting exactly which paths
  are removed, plus a guard test that an unexpected/empty scope deletes nothing.
