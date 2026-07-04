# Changelog

All notable changes to **claude-skills-pack** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-07-04

Introduces **sutra**, the orchestrator, and makes the three original members fully standalone
(Single-Responsibility). See [ADR 0002](docs/adr/0002-sutra-orchestrator-and-plugin-independence.md).
Component versions at this release: code_assist 0.7.0, sb 0.10.0, unabridged 1.0.0, sutra 0.1.0.

### Added

- **sutra** — the optional 4th plugin, the composition root that makes the pack cooperate:
  - **Capability registry** (`registry/members.json` + `sutra-tools registry`) — inverts sibling
    detection so members never name each other; a missing member no-ops its bridge.
  - **Interchange schema** (`schema/{journal,adr,review}.spec.md` + `schema-check`) — sutra owns the
    canonical artifact shapes with a conformance check, so code_assist stays ignorant of it yet drift
    is caught.
  - **Bridges** — `sync-artifacts` (parse repo artifacts → sb vault payload) and fused `recall`
    (code_assist base + sb vault, deduped, provenance-cited; never fabricates).
  - **Feedback loop** — `loop-emit` records verify/plan/incident outcomes; `bridge/ROUTER.md` +
    `loop/ROUTER.md` document the closed loop.
  - **Unified surface** — a general `sutra-agent` + `/sutra:do` catch-all, plus Tier-1 composed
    commands (`review`, `commit`, `verify`, `recall`, `sync`, `capture`). Canonical, not exclusive.
  - Zero-dep CLI + 17 self-tests + a SessionStart hook (roster + fused-recall risks).
- **code_assist** — `graph review-prep`: a deterministic blast-radius table (changed symbols →
  impactedCount, risk) that grounds review severity in the call graph, wired into the review router +
  architectural-reviewer agent (degrades cleanly without GitNexus).

### Changed

- **code_assist is now fully standalone** — removed the `bridge/` family, sibling detection, the
  sb-fusion in `recall`, and all cross-plugin handoff prose. `recall` keeps only the three harness
  stores. The placeholder check is self-contained (no unabridged dependency).
- **sb is now fully standalone** — removed `lib/repo-artifacts.js`; the repo-mirroring `sync-project`
  command becomes a generic, producer-agnostic `ingest` primitive that sutra feeds. `repoRoot` moved
  to `lib/git.js`.

## [0.6.0] - 2026-07-04

First tagged release of the pack. Bundles three self-contained, standalone-installable
Claude Code skills — `code_assist`, `sb`, and `unabridged` — distributed via the
`claude-skills-pack` marketplace. Component versions at this release: code_assist 0.6.0,
sb 0.9.1, unabridged 1.0.0.

### Added

- **Pack scaffold** — marketplace manifest, `install.sh`/`uninstall.sh`, LICENSE, README,
  and `docs/adr/` for architecture decisions.
- **code_assist** — developer-workflow powerhouse built across six waves:
  - Deterministic backbone + discipline layer with the core families: `plan`, `debug`,
    `adr`, `verify`.
  - `structure` family and integrations: `github`, `jira`, `slack`, `sonar`, `graph`,
    `format`.
  - `onboard`, `test`, `refactor`, `release` families with domain playbooks and docs.
  - Release/onboard backbone plus a self-test harness; agents, fuller domains, and a
    skill index; an opt-in LLM-graded eval harness; plugin manifests, hooks, and a
    skill bridge.
  - Bidirectional memory bridge that pulls `sb` memory / lessons / risk context back
    into code_assist.
  - `secure` family — `secret-scan`, `deps-audit`, `env-check` — with guard wiring.
  - Installable git-hooks (`pre-commit` + `commit-msg`) that enforce conventions and run
    secret-scan at the git layer.
  - `incident` family — hotfix path + blameless postmortem.
- **sb** — second-brain skill capturing conversations into a project-scoped Obsidian vault:
  self-maintenance, AI-first/verified guardrails, Obsidian Bases, and external bridges
  (phases 1–3); bi-temporal capture, eval, provenance, semantic retrieval, `init`,
  `emerge`, and idea-graduation (phase 4).
- **unabridged** — complete-output discipline skill (no truncation, no placeholders);
  code_assist's full-output families defer to it when installed.
- **sb — self-healing vault maintenance:**
  - `bin/sb-vault-repair.js` — idempotent, dry-run-by-default repair that purges
    self-capture noise, merges throwaway scopes into `_unsorted`, deletes empty
    scaffold folders, renames notes to readable `YYYY-MM-DD--<sid8>.md`, and wires
    linkage (auto-tags + project-INDEX backlinks + Related).
  - `bin/sb-connect-projects.js` — links each project's `plans/*.md` and `lessons.md`
    into its `INDEX.md` so they stop being graph orphans (containment ≠ connectivity).
  - `lib/import-helpers.js` — shared self-capture / filename / link-wiring logic used
    by both the live importer and the repair script (single source of truth).
  - `hooks/lesson-miner.js` + `hooks/lesson-miner-trigger.js` — optional SessionStart
    hook that mines finished conversations into lessons in the background.

### Fixed

- Hardening passes applied after each of waves 4, 5, and 6 (audit-driven): secret
  detectors, incident dedupe, and `--help` output in wave 6.
- **sb — four conversation-capture defects:**
  - cwd-basename scoping now routes scratch/system/dotfolder cwds to `_unsorted`
    instead of manufacturing junk scopes (`tmp`, `home`, `.claude`, `src`).
  - `backfill` filters sb's own headless `claude -p` sub-invocations (self-capture)
    and skips `<2`-turn init-only stubs.
  - conversation notes get readable date-prefixed filenames and titles derived from
    the first user turn, replacing `<uuid>__untitled.md`.
  - imported notes are auto-tagged and registered as `[[backlinks]]` under their
    project `INDEX.md`, with a top-3 `## Related` section.

[Unreleased]: https://github.com/prajwalmahajan101/claude-skills-pack/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/prajwalmahajan101/claude-skills-pack/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/prajwalmahajan101/claude-skills-pack/releases/tag/v0.6.0
