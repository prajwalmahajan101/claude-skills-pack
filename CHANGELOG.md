# Changelog

All notable changes to **claude-skills-pack** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-07-04

First tagged release of the pack. Bundles three self-contained, standalone-installable
Claude Code skills — `code_assist`, `sb`, and `unabridged` — distributed via the
`claude-skills-pack` marketplace. Component versions at this release: code_assist 0.6.0,
sb 0.9.0, unabridged 1.0.0.

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

### Fixed

- Hardening passes applied after each of waves 4, 5, and 6 (audit-driven): secret
  detectors, incident dedupe, and `--help` output in wave 6.

[Unreleased]: https://github.com/prajwalmahajan101/claude-skills-pack/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/prajwalmahajan101/claude-skills-pack/releases/tag/v0.6.0
