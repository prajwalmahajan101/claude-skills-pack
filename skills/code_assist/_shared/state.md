---
name: code_assist/_shared/state
description: Per-repo state convention - the .code_assist/ directory, STATE.md living digest, config.json profile, and resume files. Read STATE.md first in any family; keep it small.
type: shared
---

# code_assist - Per-Repo State

All code_assist state for a repo lives under `./.code_assist/` (gitignored by default).
It exists so work survives context resets and so families share a common memory.

## Layout

```
.code_assist/
├── STATE.md            # living digest (<100 lines) — READ FIRST in every family
├── config.json         # structure profile + integration prefs (written by ca-tools state-write)
├── .continue-here.md   # resume file: what was in progress + the exact next command
├── .code_review/       # review living docs (issues/history/learning/architecture_map)
├── .journal/           # journal working notes (repo journals still live in ./.journal/ or docs/)
├── .debug/DEBUG.md     # active debug session (scientific-method log)
└── .plan/              # approved plans + task breakdowns
```

## STATE.md - the living digest

Keep it under ~100 lines. It is the first thing every family reads, so it must be a
*digest*, not a log. Suggested shape:

```markdown
# code_assist state — <repo>

_Updated: <date>_

## Now
- Current branch / task in one line.

## Structure profile
- language(s), stack(s), compliance score (from `ca-tools structure-audit`).

## Open threads
- Review: N open issues (.code_review/).
- Debug: active session? (.debug/DEBUG.md).
- Plan: approved plan in .plan/ awaiting execution?

## Integrations
- tracker: jira <KEY-…> | none · notify: slack|telegram|none · scan: sonar|none
```

Read it with `node bin/ca-tools.js state-read`. Update the digest (not append) when a
family completes a step.

## config.json

Machine-readable profile, written via `node bin/ca-tools.js state-write --key K --value V`:

```json
{ "language": "python", "stack": "backend", "structure_profile": "python-service",
  "tracker": "jira", "jira_project": "ABC", "notify": "slack" }
```

Families consult this to auto-follow the project's structure and integration choices
without re-asking.

## Resume (.continue-here.md)

When you pause mid-task (or before a `/clear`), write `.continue-here.md` with:
1. one-paragraph status, 2. the exact next command to run, 3. any decision still pending.
On resume, read STATE.md then `.continue-here.md` and continue - no re-discovery.
