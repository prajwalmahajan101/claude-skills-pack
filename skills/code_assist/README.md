# code_assist

Developer-workflow skill for [Claude Code](https://claude.com/claude-code). One top-level router; three sub-skill families.

## What it does

| Family | Goal | Slash commands |
|---|---|---|
| **git-commit** | Generate atomic, conventional-commits-compliant commits. Either dry-run (paste-able plan) or interactive (stages + commits one logical change at a time). | `/code_assist:git_commit`, `/code_assist:git_commit_plan` |
| **code-review** | Senior architectural review with stack-aware routing (auto-detects backend / frontend / TUI / fullstack). | `/code_assist:code_review`, `/code_assist:code_review_backend`, `/code_assist:code_review_frontend`, `/code_assist:code_review_tui` |
| **journal** | Create or update `.journal/M<phase>.md` phase-journal entries from the project's `TEMPLATE.md`. | `/code_assist:journal` |

All three families share `shared.md` conventions; each has its own `ROUTER.md` that picks the right playbook.

## Install

```bash
./install.sh
```

This symlinks (idempotent):
- `<repo>/skills/code_assist/` → `~/.claude/skills/code_assist`
- `agents/*.md` → `~/.claude/agents/`
- `commands/*.md` → `~/.claude/commands/code_assist/`

Override target via `CLAUDE_DIR=/custom/path ./install.sh`.

## Bundled subagents

`code_assist` invokes three custom subagents that ship in `./agents/`:

| Agent | Used by | Purpose |
|---|---|---|
| `architectural-reviewer.md` | code-review | Senior architectural review pass — scoring, smells, recommendations |
| `commit-planner.md` | git-commit (plan mode for large diffs) | Groups staged + unstaged changes into atomic commits |
| `journal-writer.md` | journal | Drafts the phase journal entry from `.journal/TEMPLATE.md` and conversation context |

Without these agents installed in `~/.claude/agents/`, the skill silently degrades. The installer handles that for you.

## Triggers

The skill auto-activates from natural language (no slash command needed) for phrases like:
- "commit", "atomic commits", "split commits", "stage and commit"
- "review code", "code review", "check code quality"
- "review backend / frontend / tui"
- "journal", "journal entry", "log this phase", "phase journal"

## Architecture

```
code_assist/
├── SKILL.md                  # top-level router
├── git-commit/
│   ├── ROUTER.md             # dispatches to plan or interactive
│   ├── shared.md             # commit-message conventions
│   ├── plan.md               # dry-run mode
│   └── interactive.md        # stage-and-commit mode
├── code-review/
│   ├── ROUTER.md             # detects stack, calls one of backend/frontend/tui
│   ├── detect.md             # heuristics for stack detection
│   ├── shared.md             # rubric, scoring, output format
│   ├── backend.md
│   ├── frontend.md
│   └── tui.md
├── journal/
│   ├── ROUTER.md             # new vs update
│   ├── shared.md             # template handling
│   ├── new.md
│   └── update.md
├── agents/                   # 3 subagents shipped with the skill
└── commands/                 # 7 slash-command markdown files
```

## Uninstall

```bash
./uninstall.sh
```

Removes the symlinks under `~/.claude/skills/code_assist`, `~/.claude/agents/{architectural-reviewer,commit-planner,journal-writer}.md`, and `~/.claude/commands/code_assist/`. Source files in this directory are untouched.

## License

MIT — see [LICENSE](../../LICENSE).
