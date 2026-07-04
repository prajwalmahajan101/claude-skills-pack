---
name: code_assist/incident/hotfix
description: Disciplined production hotfix - branch from the latest release tag (not main), reproduce + fix the root cause minimally, verify with fresh evidence, then ship and merge back.
type: skill
---

# Incident - Hotfix

Goal: stop the bleeding with the **smallest correct change**, shipped from what is actually in
production - without abandoning the discipline that keeps the fix from making things worse.

## Steps (one todo each)
1. **Open the record:** `node bin/ca-tools.js incident-scaffold --title "<what broke>" --apply`.
   Note the reported **base tag** - the hotfix branches from the released code, not from `main`
   (which may contain unshipped work).
2. **Recall prior knowledge:** `node bin/ca-tools.js recall --context "<the symptom>"` - a past
   incident or risk `ref` for this area is often the fastest lead.
3. **Branch from the tag:** `git switch -c hotfix/<slug> <base-tag>`.
4. **Reproduce, then root-cause** (Iron Law - no fix without a proven cause). Keep scope tiny; this
   is not the place to refactor. Add a regression test that fails on the bug.
5. **Fix minimally** at the root cause; the regression test now passes.
6. **Verify with fresh evidence** (hand to `verify`) - prove the specific failure is gone and
   nothing adjacent broke.
7. **Ship:** `commit` (type `fix`), open the PR, `release` a patch version, deploy.
8. **Merge back** so `main` gets the fix (merge the hotfix branch / cherry-pick), avoiding a
   regression in the next release.
9. **Follow up:** once calm, write the `postmortem.md` and capture the durable lesson as a **risk**.

## Rules
- Branch from the **release tag**, not `main` - ship only the fix, nothing unreleased.
- Minimal blast radius. Tempting adjacent cleanups wait for a normal `plan`.
- The Iron Laws still hold under pressure: reproduce → prove cause → regression test → verify.
