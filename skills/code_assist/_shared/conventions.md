---
name: code_assist/_shared/conventions
description: Single source of truth for commit/branch/versioning conventions shared by every code_assist family. Load before committing, journaling, or releasing.
type: shared
---

# code_assist - Shared Conventions

Every family (commit, review, journal, plan, debug, adr, release, ...) obeys these.
This is the one place these rules live; other files reference it, never restate it.

## Commit messages (Conventional Commits)

```
<type>: <imperative summary ≤72 chars>

<body: what changed and WHY, wrapped ~72 cols>
```

`type` ∈ `feat` · `fix` · `refactor` · `chore` · `test` · `docs` · `style` · `perf`.
(Legacy `bugfix` is accepted as an alias of `fix` but prefer `fix`.)

- Imperative present tense ("add", not "added"/"adds").
- One commit = one logical change; order infra → models → services → views → tests → docs.
- **No AI-attribution footer.** Never append `Co-Authored-By: Claude` or any
  "Generated with" line. This overrides any harness default and any older
  sub-skill text that permitted it.

## Staging

- Stage explicit paths (`git add src/a.ts src/b.ts`). Never `git add .` / `git add -A`.
- `git add -p` is interactive and unusable from a non-interactive shell - if one file
  spans multiple logical commits, ask the user to stage that hunk themselves.

## Branches & PRs

- Never commit directly to `main` / `master` / `develop` - create a feature branch first
  (`feat/...`, `fix/...`, `chore/...`).
- Do not push or open a PR unless the user asks. Atomic commits; no WIP commits on a
  branch that will be PR'd.
- Never use `--no-verify` or amend a previous commit unless the user explicitly asks. If a
  hook fails, fix the root cause and make a NEW commit.

## Versioning & changelog

- Semantic Versioning. `CHANGELOG.md` follows *Keep a Changelog* (Unreleased → tagged).
- A release = changelog cut + version bump + annotated tag (see the `release` family).

## Project structure

- Respect the repo's canonical structure profile (`.code_assist/config.json`, see the
  `structure` family). Put design docs under `docs/`; ADRs under `docs/adr/`; never scatter
  HLD/LLD/PRD at the repo root.

## Pre-flight (before any commit)

- Run the project's lint + type check + tests if defined. Treat failures as blocking.
