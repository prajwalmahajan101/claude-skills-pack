---
name: code_assist/secure/env
description: Detect .env drift - keys present in .env.example but missing from .env (and extras). Names only, never values.
type: skill
---

# Secure - Env Check

Goal: keep runtime config honest - every key the app expects is documented, and nothing secret
lives in the tracked example.

## Steps (one todo each)
1. **Check drift:** `node bin/ca-tools.js env-check [dir]`. It diffs `.env` keys against
   `.env.example` / `.env.sample` / `.env.template` and reports `{missing, extra}` - **key names
   only, never values**.
2. **Resolve:**
   - `missing` (in example, not in your `.env`) → add them so the app has what it needs.
   - `extra` (in `.env`, not in the example) → either document the key in the example (so the next
     dev knows to set it) or remove it if dead.
3. **Guard the example:** `.env.example` is tracked - it must contain **only key names / dummy
   placeholders**, never a real value. Run `secret-scan` over it if unsure.
4. **Confirm `.env` is git-ignored.** A real `.env` must never be committed (the git-guard secret
   scan is the backstop).
