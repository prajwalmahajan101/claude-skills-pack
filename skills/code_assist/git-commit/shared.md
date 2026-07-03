---
name: code_assist/git-commit/shared
description: Commit message format and global rules shared by plan and interactive sub-skills
type: shared
---

# Git-Commit — Shared Rules & Message Format

This file is included by `plan.md` and `interactive.md`. Read it before executing either.

---

## Commit Message Format

### Header

```
type: short summary in imperative present tense
```

**Type** must be one of:

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `bugfix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `chore` | Build, config, dependency, or tooling changes |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `style` | Formatting, whitespace, linting (no logic change) |
| `perf` | Performance improvement |

**Summary rules:**
- Imperative present tense ("add", not "added" or "adds")
- Concise and descriptive
- Max **72 characters** for the full header line

### Body

- Explain **what** changed and **why**.
- Include important technical details or impact.
- Wrap lines at 72 characters.
- **No signatures or footers of any kind** — including `Co-Authored-By: Claude` or any
  "Generated with" line. See `_shared/conventions.md` (single source of truth).

---

## Commit Strategy

- One commit per single logical change.
- Order commits to reflect the correct evolution (infrastructure before features, models before views, etc.).
- Stage by specific file paths (e.g., `git add src/auth.ts src/routes/login.ts`). `git add -p` is interactive and not usable from Bash — if a single file contains changes that belong to multiple commits, ask the user to perform that staging step themselves.

Group changes into logical units:
- New feature or endpoint
- Refactor (no behavior change)
- Bug fix
- Tests
- Documentation
- Style / formatting
- Dependency or config changes

---

## Global Rules

- **Never** use `git add .` or `git add -A` — always stage specific files.
- **Never** use `--no-verify` (or any hook-skipping flag) unless the user explicitly asks.
- **Never** amend a previous commit unless the user explicitly asks.
- If a commit fails (e.g., pre-commit hook), fix the root cause and create a **new** commit — do not amend.
- Do not include commentary outside the commit plan and interactive prompts.
