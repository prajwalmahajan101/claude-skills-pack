---
name: sb
description: "Second-brain skill — captures every Claude Code conversation into the ai-mind Obsidian vault, scoped by project (cwd). Use proactively when the user mentions 'lesson', 'topic note', 'kanban', 'tasks', 'second brain', 'remember this', or asks about past conversations / decisions / action items. Subcommands: /sb:status /sb:analyze /sb:lesson /sb:topic /sb:tasks /sb:task /sb:kanban /sb:connect /sb:tag /sb:search /sb:project /sb:backfill."
trigger: /sb
---

# Second Brain (`sb`)

Persistent second brain for Claude Code, backed by the `ai-mind` Obsidian vault.

## What it does

- **Captures** every conversation automatically (Stop hook → `conversations/<project>/<session>.md`).
- **Scopes** notes by project — one project per `cwd`. Each gets `INDEX.md`, `kanban.md`, `lessons.md`, `plans/`.
- **Analyzes** unprocessed conversations into lessons, takeaways, action items, and tags (via `claude -p` → Haiku, JSON schema).
- **Tracks** project tasks via Kanban markdown boards.
- **Connects** notes across projects (tag overlap + keyword similarity).
- **Topic notes** for evergreen reference (CRUD, observability, k8s, etc.).
- **Auto-tags** notes from rules + LLM suggestions.

## Subcommands

| Command | Purpose |
|---|---|
| `/sb:status` | Project + brain dashboard |
| `/sb:analyze [sid?]` | Mine un-analyzed conversations → lessons/takeaways/actions/tags |
| `/sb:lesson "<title>"` | Capture a lesson from the current conversation |
| `/sb:topic <slug>` | Create or extend a study/topic note |
| `/sb:tasks [--project] [--all]` | List pending kanban tasks |
| `/sb:task add "<text>" [...]` | Add task to project kanban |
| `/sb:task done <n\|prefix>` | Mark task done |
| `/sb:kanban [--project] [--open]` | Render/open project kanban |
| `/sb:connect [--current]` | Suggest links between notes |
| `/sb:tag [path?]` | Auto-tag notes |
| `/sb:search <query>` | Vault full-text search via Obsidian CLI |
| `/sb:project [<slug>]` | List projects / show project INDEX |
| `/sb:backfill [--days N\|--all]` | Import historical conversations |

## When to invoke

- User mentions "lesson learned", "remember this", "note this decision" → `/sb:lesson`
- User asks "what's on my plate?", "show tasks", "todos" → `/sb:tasks` or `/sb:status`
- User wants to study a topic or build reference notes → `/sb:topic`
- User asks "what did we figure out about X?" → `/sb:search`
- After a significant decision, root-cause discovery, or pivot → `/sb:lesson` then `/sb:connect --current`
- User says "set up second brain" or "install sb" → point them at `~/Desktop/git_projects/my_work/main-project/secondbrain_obsidian_claude/README.md`

## Vault layout

```
~/Documents/vaults/ai-mind/
├── conversations/<project>/<session>.md   # auto
├── projects/<project>/{INDEX,kanban,lessons}.md + plans/
├── lessons/<YYYY-MM-DD>-<slug>.md
├── topics/<slug>.md
├── connections/<theme>.md
├── inbox/
├── templates/
├── tags.md
└── _meta/{session-map,tag-rules}.json
```

## Configuration env vars

| Var | Default | Purpose |
|---|---|---|
| `SB_VAULT_PATH` | `~/Documents/vaults/ai-mind` | Vault root |
| `SB_VAULT_NAME` | `ai-mind` | Vault name for `obsidian vault=…` calls |
| `SB_ANALYZER_MODEL` | `claude-haiku-4-5-20251001` | Model for `/sb:analyze` |
| `SB_ANALYZER_MAX_TURNS` | `60` | Truncate longer convos |
| `SB_CAPTURE_DEBOUNCE_MS` | `5000` | Min gap between writes |
| `SB_CLAUDE_BIN` | `claude` | Path to claude CLI |
| `SB_DISABLE` | unset | `1` to suppress all sb hooks |

## Implementation

- `lib/vault.js` — path/slug helpers, session-map I/O
- `lib/jsonl.js` — parse session JSONL → ordered turns
- `lib/markdown.js` — render turns; append-aware
- `lib/analyzer.js` — `claude -p` wrapper, JSON-schema extraction
- `lib/tagger.js` — rules + LLM tag merging
- `lib/kanban.js` — Obsidian Kanban markdown CRUD
- `lib/connector.js` — link suggestion engine
- `hooks/sb-capture.js` — Stop/SubagentStop, writes conversation file
- `hooks/sb-plan-mirror.js` — PostToolUse, mirrors plans
- `hooks/sb-session-start.js` — scaffolds project dir
