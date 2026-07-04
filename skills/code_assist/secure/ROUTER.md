---
name: code_assist/secure/ROUTER
description: Routes security-hygiene work - secret scanning, dependency/supply-chain audit, and .env drift. Enforces what the plugin preaches (never commit secrets, validate at boundaries). Findings are blocking.
type: router
---

# Secure Router

Load `_shared/discipline.md` + `_shared/conventions.md`. **Security findings are blocking**, style
findings are informational (matches `domains/security.md`). Everything here is read-only /
non-mutating - nothing calls out or auto-fixes.

| Situation | Load | Command |
|---|---|---|
| "did I stage a secret?", pre-commit secret check | `secret-scan.md` | `/code_assist:secure` |
| "any vulnerable deps?", supply-chain audit | `deps.md` | `/code_assist:secure_deps` |
| ".env drift", missing/extra config keys | `env.md` | `/code_assist:secure` (env) |

## Backbone

- `node bin/ca-tools.js secret-scan --staged` - detect committed secrets in staged content;
  masked output (never prints a value). Also `--range <a..b>` or explicit `<paths...>`.
- `node bin/ca-tools.js deps-audit [dir]` - read-only vuln audit via the repo's own tool
  (`npm/pip/cargo/go`); degrades with a hint when the tool is absent.
- `node bin/ca-tools.js env-check [dir]` - `.env` vs `.env.example` key drift (names only).

## Rules

- **Never print or echo a real secret value.** The scanner masks; keep it masked.
- A secret finding blocks the commit path - remove it and rotate the exposed credential (a
  committed secret is compromised even after deletion). Use env/secret-manager instead.
- False positive? Annotate the line with `# ca:allow-secret` (or `// ca:allow-secret`), or add a
  substring/pattern to `.ca-secretsignore`. Justify it - an allowlist that only grows is a smell.
- The `ca-git-guard` hook runs `secret-scan --staged` on every commit (warn by default, block under
  `CA_GIT_GUARD_STRICT=1`); `secure` is the interactive, whole-repo counterpart.

> **Note:** a recurring class of leak (or a resolved audit finding) recorded as a lesson tagged
> `risk` is surfaced by `recall` in future reviews.
