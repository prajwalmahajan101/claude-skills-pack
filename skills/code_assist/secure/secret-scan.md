---
name: code_assist/secure/secret-scan
description: Scan for committed secrets (API keys, tokens, private keys, generic key=value secrets) with masked, provenance-carrying output. Zero-dep; prefers gitleaks when installed.
type: skill
---

# Secure - Secret Scan

Goal: prove no credential is about to be (or already is) committed. Never print a real value.

## Steps (one todo each)
1. **Scan the right scope.**
   - Pre-commit: `node bin/ca-tools.js secret-scan --staged` (staged blobs).
   - A diff/PR: `node bin/ca-tools.js secret-scan --range <base>..<head>`.
   - Specific files / whole tree: `node bin/ca-tools.js secret-scan <paths...>`.
2. **Read the findings** - each is `{file, line, rule, masked}`. Rules: `aws-access-key`,
   `google-api-key`, `slack-token`, `github-token`, `private-key`, `jwt`, `generic-secret`
   (and `gitleaks:*` when gitleaks is installed). The value is masked - keep it that way.
3. **Triage each finding:**
   - Real secret → **stop**. Remove it from the code, move it to env / a secret manager, and
     **rotate** the credential (exposure = compromise, even if you delete the line).
   - False positive (a placeholder, a test fixture, an example) → annotate the line with
     `# ca:allow-secret` / `// ca:allow-secret`, or add a substring/pattern to `.ca-secretsignore`.
     Say why in the commit - a growing allowlist is the real smell.
4. **Re-scan** until `count: 0`, then proceed to commit.

## Notes
- The `ca-git-guard` hook already runs this on every `git commit` (warn, or block under
  `CA_GIT_GUARD_STRICT=1`) - this family is the deliberate, whole-repo pass.
- Installing `gitleaks` widens coverage automatically (its findings merge in, deduped).
