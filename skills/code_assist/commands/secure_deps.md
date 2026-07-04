---
name: code_assist:secure_deps
description: Dependency / supply-chain vulnerability audit (read-only) via the repo's own tool. Triggers on "audit dependencies", "vulnerable packages", "npm audit", "supply chain", "CVE in deps".
---

# /code_assist:secure_deps

Read `~/.claude/skills/code_assist/secure/ROUTER.md` and follow the `deps.md` path - run a
read-only `deps-audit` and triage advisories. Never auto-bumps; upgrades are a `plan` + `verify`.
