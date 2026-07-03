---
name: code_assist/release/changelog
description: Move the CHANGELOG Unreleased section into a dated, versioned release entry from the commit history.
type: skill
---

# Release - Changelog

## Steps
1. **Determine the version** (SemVer) from the nature of changes since the last tag:
   breaking -> major, new features -> minor, fixes only -> patch. Confirm with the user.
2. **Gather changes**: `git log <last-tag>..HEAD --oneline`, grouped by Conventional Commit
   type (feat -> Added/Changed, fix -> Fixed, etc.).
3. **Rewrite `CHANGELOG.md`**: turn `## [Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD` with
   grouped bullets (Added / Changed / Fixed / Removed), and open a fresh empty `## [Unreleased]`
   above it.
4. Keep entries user-facing and concise; link issues/PRs where relevant.

## Rules
- Follow Keep a Changelog structure exactly.
- Do not invent changes - derive them from the commit history and diffs.
