---
name: code_assist
description: "Developer workflow skill for git commits, code reviews, and phase journals. Use this skill whenever the user wants to: commit code changes (atomic commits, smart staging, conventional commits), review code quality (architectural review, codebase health scoring) for backend / frontend / TUI / fullstack repos, write a phase journal entry from the project's .journal/TEMPLATE.md, or says anything like 'commit', 'git commit', 'review code', 'code review', 'check code quality', 'review the codebase', 'commit my changes', 'split commits', 'atomic commits', 'review frontend', 'review backend', 'review tui', 'journal', 'journal entry', 'log this phase', 'phase journal', 'update journal', 'start a new journal'. Always use this skill instead of doing raw git commits, ad-hoc code reviews, or hand-rolled journal entries."
---

# code_assist — Developer Workflow Skill

Routes to the correct sub-skill family based on the user's request.

## Top-Level Routing

| Request | Sub-skill router | Slash command |
|---|---|---|
| Commit changes, atomic commits, split commits, stage & commit, dry-run commit plan | `git-commit/ROUTER.md` | `/code_assist:git_commit` |
| Code review, architecture review, codebase quality check, review backend/frontend/tui | `code-review/ROUTER.md` | `/code_assist:code_review` |
| Phase journal — create / update `.journal/M<phase>.md` from project `TEMPLATE.md` | `journal/ROUTER.md` | `/code_assist:journal` |

## How to Use

1. Identify whether the request is about **committing**, **reviewing**, or **journaling**.
2. Read the matching router file:
   - Commits → `/home/prjawal/.claude/skills/code_assist/git-commit/ROUTER.md`
   - Reviews → `/home/prjawal/.claude/skills/code_assist/code-review/ROUTER.md`
   - Journal → `/home/prjawal/.claude/skills/code_assist/journal/ROUTER.md`
3. The router selects a sub-skill (plan vs. interactive for commits; backend / frontend / tui / fullstack for reviews; new vs. update for journal) and tells you which files to load next.

The slash commands `/code_assist:code_review`, `/code_assist:git_commit`, `/code_assist:journal`, plus the per-variant commands (`code_review_backend`, `code_review_frontend`, `code_review_tui`, `git_commit_plan`) are thin entry points — they all read the same router/sub-skill files.

## Combined Requests

If the user asks for multiple actions:

- "review then commit" → run code-review first, then git-commit after issues are resolved.
- "commit then journal" → run git-commit first so the journal can reference the new SHAs, then journal.
- "review, commit, journal" → review → commit → journal, in that order.

## Preconditions

If not inside a git repository, inform the user and stop.

## Sub-skill Tree

```
code_assist/
├── git-commit/
│   ├── ROUTER.md     # plan vs interactive
│   ├── shared.md     # commit message format + rules
│   ├── plan.md       # dry-run output only
│   └── interactive.md
├── code-review/
│   ├── ROUTER.md     # backend / frontend / tui / fullstack
│   ├── detect.md     # stack detection
│   ├── shared.md     # steps, output schema, living docs
│   ├── backend.md    # backend weights + anti-patterns
│   ├── frontend.md   # frontend weights + anti-patterns
│   └── tui.md        # TUI/CLI weights + anti-patterns
└── journal/
    ├── ROUTER.md     # new vs update
    ├── shared.md     # template structure, phase discovery, global rules
    ├── new.md        # create fresh M<phase>.md from TEMPLATE.md
    └── update.md     # append to / refine existing entry
```
