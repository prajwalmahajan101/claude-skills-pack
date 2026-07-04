---
name: code_assist/secure/deps
description: Read-only dependency / supply-chain vulnerability audit via the repo's own tool (npm/pip/cargo/go). Never mutates - reports advisories for you to triage.
type: skill
---

# Secure - Dependency Audit

Goal: surface known vulnerabilities in dependencies. Read-only - this never runs an
auto-`fix`/`update` (that is a reviewed change, not a scan).

## Steps (one todo each)
1. **Audit:** `node bin/ca-tools.js deps-audit [dir]`. It detects the manager from the manifest
   (`package-lock.json` → npm, `Cargo.lock` → cargo, `pyproject/requirements` → pip-audit,
   `go.mod` → govulncheck) and runs its **read-only** audit. If the tool is absent it returns a
   hint, not a crash.
2. **Read `counts` + `advisories`** - `{pkg, severity, id, title}`. Treat `critical`/`high` as
   blocking for a release; `moderate`/`low` as informational unless reachable.
3. **Triage, don't blindly bump:** for each blocking advisory, check whether the vulnerable path
   is actually reachable, then plan the upgrade (patch vs major) - a major bump is its own
   `plan` + `verify` cycle, not a reflex. Record a deliberate deferral as a risk lesson.
4. **Lockfile hygiene:** pin/refresh the lockfile; review lockfile diffs in `code_review` (a
   surprise transitive change is a supply-chain signal).

## Notes
- Network/tool-dependent and slower than the other checks - run it in review/release, not on
  every commit. Absent tool ⇒ install hint (e.g. `pip-audit`, `cargo audit`, `govulncheck`).
