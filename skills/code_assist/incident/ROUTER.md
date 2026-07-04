---
name: code_assist/incident/ROUTER
description: Routes production-incident work - the disciplined hotfix path (branch from the release tag, minimal fix, expedited verify) and the blameless postmortem. The one workflow for when production is on fire.
type: router
---

# Incident Router

Load `_shared/discipline.md` + `_shared/conventions.md`. Incidents are the highest-pressure moment
- which is exactly when the Iron Laws matter most (no fix without a reproduced cause, no "done"
without evidence). Speed comes from a tight scope, not from skipping the discipline.

| Situation | Load | Command |
|---|---|---|
| Production is broken - ship a minimal fix now | `hotfix.md` | `/code_assist:incident` |
| Incident is resolved - write the blameless postmortem | `postmortem.md` | `/code_assist:incident_postmortem` |

## Backbone

- `node bin/ca-tools.js incident-scaffold --title "<what broke>" [--apply]` - creates the next
  `docs/incidents/NNNN-<slug>.md` from the blameless template and reports the **latest release tag**
  (the hotfix base). Dry-run by default.

## The closed loop (why incidents feed the whole pack)

A postmortem's action-items and lessons should be captured as a lesson tagged **risk**, so `recall`
then surfaces that risk automatically in future `plan`/`debug`/`review` and at session start - the
same class of outage is caught before it recurs.

> **Note:** `postmortem` writes `docs/incidents/` and should record a lesson tagged `risk`.
> `hotfix` ends in `verify` then `release`.
