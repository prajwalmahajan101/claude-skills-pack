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

## Anti-patterns (reject in review)
- **String-built SQL:** `f"SELECT ... WHERE id = {id}"`. Fix: parameterized query / prepared
  statement. No exceptions "because it's an internal id".
- **Authorization by obscurity / IDOR:** `GET /orders/{id}` that trusts the id without checking it
  belongs to the caller. Fix: scope every fetch by the authenticated principal (`WHERE account_id
  = <ctx>`), deny by default.
- **Secret in code/log/error:** committed key, or `log.info(f"token={t}")`. Fix: env/secret-manager;
  redact tokens in logs; rotate anything that ever landed in git history.
- **Roll-your-own crypto / `==` on secrets:** custom hashing, or non-constant-time token compare.
  Fix: vetted libs (argon2/bcrypt for passwords), `crypto.timingSafeEqual` for tokens.
- **Reflecting unescaped input:** user text into HTML/template/shell. Fix: context-aware
  encode on output; never build shell strings from input (use argv arrays).
- **Trusting the client:** price/role/quantity read from the request body. Fix: derive
  server-side; validate + normalize shape at the edge and reject unexpected fields.

## When a finding lands
Treat security findings from `/code_assist:scan` (Sonar/Semgrep) or CodeQL as **blocking**. Either
fix, or document an explicit, reviewed suppression with rationale - never silently ignore. Capture
the decision as an ADR if it changes a boundary or a trust assumption.

## Deeper references (optional)
`tob-static-analysis`, `static-analysis:{semgrep,codeql,sarif-parsing}`, `sharp-edges`,
`differential-review`, the `testing-handbook-skills:*` fuzzing set, `audit-context-building`.
