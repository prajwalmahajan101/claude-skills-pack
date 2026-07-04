---
name: code_assist:secure
description: Security hygiene - scan for committed secrets, check .env drift, enforce "never commit secrets". Triggers on "scan for secrets", "did I commit a key", "check secrets", "secret scan", "env check", "leaked credentials".
---

# /code_assist:secure

Read `~/.claude/skills/code_assist/secure/ROUTER.md` and follow it. Default to `secret-scan.md`
(the most common ask); route to `env.md` for `.env` drift or `deps.md` for a dependency audit.
