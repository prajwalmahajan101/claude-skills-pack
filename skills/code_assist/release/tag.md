---
name: code_assist/release/tag
description: Create the annotated release tag and (confirm-gated) publish a GitHub release. Outward-facing - confirm before pushing/publishing.
type: skill
---

# Release - Tag

## Steps
1. **Pre-flight**: ensure the changelog + version-bump commits are in, the working tree is
   clean, and the `land` chain passed (structure/scan/review/verify). Never tag broken code.
2. **Create an annotated tag**: `git tag -a vX.Y.Z -m "vX.Y.Z"` - message summarizes the release.
3. **Confirm before pushing.** `git push origin vX.Y.Z` is outward-facing - show it and get
   explicit confirmation. Do not push without being asked.
4. **Optional GitHub release** (confirm-gated): `gh release create vX.Y.Z --notes-from-tag`
   (or notes from the changelog section). Show the command first.

## Rules
- Annotated tags only (never lightweight) for releases.
- Tag pushes and `gh release create` require explicit confirmation - they are public actions.
- If a release step fails, do not force - fix and re-run; never delete/retag a published tag
  without the user's say-so.
