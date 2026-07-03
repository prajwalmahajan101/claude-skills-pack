---
name: code_assist/release/version
description: Bump the version string in the project's manifest(s) to match the release.
type: skill
---

# Release - Version

## Steps
1. **Locate the version source** for the stack:
   - Python: `pyproject.toml` (`project.version`) / `__version__`.
   - JS/TS: `package.json` (`version`).
   - Rust: `Cargo.toml` (`package.version`).
   - Go: the tag itself is the version (no manifest bump).
2. **Set** it to the chosen SemVer version (matching the changelog entry).
3. Update any lockfile that records the version, and any `__version__`/constant duplicated in
   code (search for the old version string).

## Rules
- One source of truth for the version; keep duplicates in sync.
- Commit the bump as `chore(release): vX.Y.Z` - no other changes in that commit.
