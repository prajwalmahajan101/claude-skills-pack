---
name: code_assist/release/ROUTER
description: Cut a release - update CHANGELOG, bump the version, tag, and (confirm-gated) publish via gh. Follows SemVer + Keep a Changelog.
type: router
---

# Release Router

Load `_shared/conventions.md`. SemVer + Keep a Changelog.

| Step | Load | Command |
|---|---|---|
| Update CHANGELOG (Unreleased -> version) | `changelog.md` | `/code_assist:release` |
| Bump version in manifests | `version.md` | `/code_assist:release` |
| Tag + optional GitHub release | `tag.md` | `/code_assist:release` |

A full release runs all three in order. Each is confirm-gated where it is outward-facing
(tagging, pushing, publishing).

## Handoff
Pre-release, run the orchestrator `land` chain (structure audit + scan + review + verify) so
you never tag broken code.
