---
name: code_assist/domains/security
description: Condensed security playbook - authz, secrets, input validation, static analysis, common vulns. Self-contained; defensive/authorized use only.
type: skill
---

# Domain - Security

Defensive and authorized-testing use only. For dual-use tooling, require clear authorization
context (pentest engagement, CTF, security research, defensive use).

## Boundaries & authz
- Validate + authorize at every boundary. RBAC with least privilege; deny by default.
- AuthN != AuthZ - check permissions per resource, not just "logged in". For Supabase, RLS is
  the boundary (see `domains/data.md`).

## Input & injection
- Parameterized queries only (no string-built SQL). Escape/encode on output (XSS).
- Validate + normalize all input at the edge; reject unexpected shapes. Guard against SSRF,
  path traversal, deserialization, and template injection.

## Secrets & crypto
- Secrets from env/secret-manager, never in code or logs. Rotate; scope tightly.
- Use vetted libraries; never roll your own crypto. Constant-time comparisons for tokens.
- Audit-log sensitive mutations.

## Supply chain & CI
- Pin dependencies; enable dependabot/renovate; review lockfile changes.
- Wire static analysis into review (`/code_assist:scan` - Sonar/Semgrep). Treat security
  findings as blocking, style as informational. CodeQL for deeper dataflow.

## Deeper references (optional)
`tob-static-analysis`, `static-analysis:{semgrep,codeql,sarif-parsing}`, `sharp-edges`,
`differential-review`, the `testing-handbook-skills:*` fuzzing set, `audit-context-building`.
