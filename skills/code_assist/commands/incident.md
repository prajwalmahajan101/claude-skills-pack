---
name: code_assist:incident
description: Production incident - disciplined hotfix (branch from the release tag, minimal root-cause fix, verify) and blameless postmortem. Triggers on "production is down", "hotfix", "prod incident", "we have an outage", "sev1", "roll back and fix".
---

# /code_assist:incident

Read `~/.claude/skills/code_assist/incident/ROUTER.md` and follow it. Default to `hotfix.md` when
something is actively broken; route to `postmortem.md` once it is resolved. Even under pressure the
Iron Laws hold - reproduce, prove the cause, regression-test, verify.
