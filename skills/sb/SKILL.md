---
name: sb
description: "Second-brain skill — captures every Claude Code conversation into the ai-mind Obsidian vault, scoped by project (cwd). Use proactively when the user mentions 'lesson', 'topic note', 'kanban', 'tasks', 'second brain', 'remember this', or asks about past conversations / decisions / action items. Subcommands: /sb:status /sb:analyze /sb:lesson /sb:topic /sb:tasks /sb:task /sb:kanban /sb:connect /sb:tag /sb:search /sb:project /sb:backfill /sb:consolidate /sb:health /sb:bases."
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
- **AI-first notes** — lessons/topics carry a `## For future Claude` preamble + `ai-first: true`; a non-blocking Write/Edit validator warns on notes that miss it.
- **Self-maintenance** — `/sb:consolidate` dedupes lessons, archives stale conversations, and promotes durable lessons to memory (manual, dry-run by default); `/sb:health` audits the vault.
- **Obsidian Bases** — `/sb:bases` generates database views (Lessons, Projects, Conversations, Tasks, Memory) in `00_Dashboard/`.
- **External memory bridges** — promotes durable lessons into the harness file-memory (`~/.claude/projects/.../memory`) and logs activity to the `~/.remember` rolling history; new-session INDEX surfaces both.

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
| `/sb:consolidate [--apply]` | Dedupe lessons, archive stale convos, promote durable→memory, import global lessons (dry-run unless `--apply`) |
| `/sb:health [--json]` | Read-only vault audit (orphans, duplicates, stale tasks, malformed frontmatter) |
| `/sb:bases` | (Re)generate Obsidian Bases views into `00_Dashboard/` |
| `/sb:sync-project [--all\|--repo <p>]` | Mirror a repo's `.journal/` + `.code_review/` into `02_Projects/<slug>/{journal,reviews}` + surface open issues |
| `/sb:decision "<title>" [--from-council]` | Capture an ADR (Context/Decision/Consequences/Usage) into `02_Projects/<slug>/decisions` + global `11_Decisions` |
| `/sb:lessons-import [--push]` | Import `~/.claude/lessons` into the vault; `--push` writes sb lessons back to the global INDEX |
| `/sb:graph [--project <slug>]` | Build a knowledge graph via graphify + mirror `graphify-out/` into `09_Exports/graph` |
| `/sb:zettel "<claim>"` | Atomic permanent Zettelkasten note (claim-title, related/sources) in `14_Zettelkasten` |
| `/sb:meeting "<title>" [--attendees a,b]` | Meeting note; attendees auto-linked to People + interaction-logged |
| `/sb:person <name> [--log "..."]` | People/CRM note + interaction log in `12_People` |
| `/sb:habit "<name>" [--done\|--list]` | Habit tracker with streaks in `15_Habits` |
| `/sb:verify <slug>` | Mark an AI-drafted note human-verified (clears the `[!ai]` callout + review queue) |
| `/sb:challenge <slug>` | Append a skeptical `## Challenge` pass using your own related notes |
| `/sb:ask-highlights "<query>"` | Verbatim-only retrieval (quotes + `file:line`), never generated prose |
| `/sb:dashboard` | Regenerate the Life-Dashboard homepage (`00_Dashboard/Home.md`) |

Note: `/sb:task new "<title>" [--parent <slug>]` supports hierarchical sub-tasks. Haiku-drafted
notes (`/sb:lesson`, `/sb:decision`, `/sb:zettel --draft`) are written `verified: false` with a
visible `[!ai]` callout and appear in `unverified.base` until `/sb:verify`.

Note: `/sb:lesson "<title>" [--memory]` — `--memory` (or a model `durable:true` flag) also promotes the lesson to harness file-memory.

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
| `SB_VALIDATE_DISABLE` | unset | `1` to mute the AI-first Write/Edit validator |
| `SB_CONSOLIDATE_STALE_DAYS` | `90` | Age after which an analyzed conversation is archive-eligible |
| `SB_MEMORY_DIR` | `~/.claude/projects/<sanitized-home>/memory` | Harness file-memory location |
| `SB_MEMORY_PROMOTE` | unset | `0` to disable promoting durable lessons to memory |
| `SB_REMEMBER_DIR` | `~/.remember` | Rolling activity-history location |
| `SB_LESSONS_DIR` | `~/.claude/lessons` | Global (canonical) lessons store for the bridge |

## Implementation

- `lib/vault.js` — path/slug helpers, session-map I/O
- `lib/jsonl.js` — parse session JSONL → ordered turns
- `lib/markdown.js` — render turns; append-aware
- `lib/analyzer.js` — `claude -p` wrapper, JSON-schema extraction
- `lib/tagger.js` — rules + LLM tag merging
- `lib/kanban.js` — Obsidian Kanban markdown CRUD
- `lib/connector.js` — link suggestion engine
- `lib/ai-first.js` — `## For future Claude` preamble + frontmatter + note validation
- `lib/memory-bridge.js` — promote/list/mirror harness file-memory facts
- `lib/remember-bridge.js` — append/read the `~/.remember` rolling history
- `lib/repo-artifacts.js` — read a repo's `.journal/` + `.code_review/` (issues parsing)
- `lib/lessons-bridge.js` — import/list/push the global `~/.claude/lessons` store
- `commands/_runners/{consolidate,health,bases}.js` — self-maintenance + Bases
- `commands/_runners/{sync-project,decision,lessons-import,graph}.js` — external-skill integrations
- `hooks/sb-capture.js` — Stop/SubagentStop/**PreCompact**, writes conversation file (`type: conversation`)
- `hooks/sb-plan-mirror.js` — PostToolUse, mirrors plans
- `hooks/sb-validate.js` — PostToolUse (Write/Edit), non-blocking AI-first validator
- `hooks/sb-session-start.js` — scaffolds project dir; injects Memory & Remember section
