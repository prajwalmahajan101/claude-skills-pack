# Second Brain Skill for Claude Code (`sb`)

## Context

The user wants Claude Code to feed a persistent second brain stored in the `ai-mind` Obsidian vault. Every conversation should be captured, indexed by the directory ("project") it ran in, deduplicated across `/resume` sessions, and post-processable into lessons / takeaways / action items. Projects get their own kanban board and plans archive; cross-project knowledge accumulates as topic notes (CRUD, observability, etc.), lesson notes, and connection MOCs. Auto-tagging keeps the graph navigable.

Build it as a single Claude Code skill (`sb`) + a small set of nodejs hooks. Use `claude -p` for analysis (no extra API key) and capture only new sessions going forward. Ship a v1 covering capture / projects / plans / analysis / tasks / lessons / topics / connections / tags, then iterate.

## Architecture overview

### Vault layout (`~/Documents/vaults/ai-mind/`)

```
ai-mind/
├── conversations/<project-slug>/<session-uuid>__<slug>.md   # one per session, append on /resume
├── projects/<project-slug>/
│   ├── INDEX.md          # auto-generated dashboard (Dataview-style links)
│   ├── plans/            # mirror of ~/.claude/plans/ scoped to this project
│   ├── kanban.md         # project task board (markdown Kanban format)
│   └── lessons.md        # lessons specific to this project
├── lessons/<YYYY-MM-DD>-<slug>.md     # cross-cutting lessons (vault root)
├── topics/<topic-slug>.md             # study notes (CRUD, observability, react-hooks…)
├── connections/<theme>.md             # MOC notes linking across projects/topics
├── inbox/                             # captured but unprocessed items
├── templates/                         # frontmatter templates for each note type
├── tags.md                            # aggregated tag index
└── _meta/
    ├── session-map.json   # sessionId → {file, project, started_at, last_updated, turns, model, analyzed}
    └── tag-rules.json     # keyword → tag mapping for the auto-tagger
```

### Conversation file format

```yaml
---
session_id: <uuid>
title: <claude session title>
project: <slug>
project_path: /abs/path
model: claude-opus-4-7
started_at: 2026-05-24T10:00:00Z
last_updated: 2026-05-24T14:30:00Z
duration_minutes: 270
turn_count: 24
plans: [we-have-a-skill-starry-dewdrop.md]
tags: []
analyzed: false
analysis_summary: null
resumed_from: null    # set if this was a /resume of another session
---

# <title>

## Turn 1 — 2026-05-24 10:00
**user:** …
**assistant:** …
```

Append-only on `/resume`: the hook detects the existing file by `sessionId` and writes new turns under a `## Resume YYYY-MM-DD HH:MM` separator.

## Components

### 1. Skill files (`~/.claude/skills/sb/`)

| File | Purpose |
|---|---|
| `SKILL.md` | Skill definition. Frontmatter: `name: sb`, description triggers on "second brain", "lesson", "kanban", "topic note", etc. Documents all `/sb:*` subcommands and when to invoke them. |
| `lib/vault.js` | Resolves vault path, project slug from cwd, ensures dirs, reads/writes `session-map.json`. |
| `lib/jsonl.js` | Parses `~/.claude/projects/<cwd>/<uuid>.jsonl` → ordered turn list (user / assistant text, hides tool noise). |
| `lib/markdown.js` | Renders turns to markdown; handles append vs full-rewrite. |
| `lib/analyzer.js` | Wraps `claude -p --model haiku` with a structured prompt → JSON `{lessons[], takeaways[], action_items[], tags[]}`. |
| `lib/tagger.js` | Rules-based tagging from `tag-rules.json` + LLM-suggested tags from analyzer output. |
| `lib/kanban.js` | Parse / mutate Obsidian Kanban markdown (`## To Do`, `## Doing`, `## Done` columns with `- [ ] task` items). |
| `lib/connector.js` | Compute tag overlap + recent-shared-keywords between notes; suggest links. |

### 2. Hooks (`~/.claude/hooks/`)

| Hook | Event | Behavior |
|---|---|---|
| `sb-capture.js` | `Stop` (and `SubagentStop`) | Read current `sessionId` + `cwd` from hook input JSON. Read latest turns from the JSONL. Append/create the conversation file. Update `session-map.json` metadata (turn_count, last_updated, duration). Debounced to ≤1 write per 5s. |
| `sb-plan-mirror.js` | `PostToolUse` on `Write\|Edit`, with `if: "Edit(~/.claude/plans/**)"` | When a plan file is written/edited, copy it to `vault/projects/<slug>/plans/<basename>`. Idempotent. |
| `sb-session-start.js` | `SessionStart` | Ensure project dirs exist; if first session in a new cwd, scaffold `projects/<slug>/{INDEX.md, kanban.md, lessons.md}` from templates. |

Registered in `~/.claude/settings.json` under existing `hooks` block.

### 3. Slash commands (`~/.claude/commands/sb/` — symlinks to `~/.claude/skills/sb/commands/*.md`)

| Command | What it does |
|---|---|
| `/sb:status` | One-screen overview: current project, un-analyzed conversation count, pending tasks across all projects, recent lessons. Default entrypoint. |
| `/sb:analyze [session_id?]` | Process unanalyzed conversations (or one specific). Writes `lessons.md` entries (project + root), appends action items to project kanban "To Do", merges tags. |
| `/sb:lesson "<title>"` | Manually capture a lesson from the current conversation. Wraps `analyzer.js` with a single-lesson schema. |
| `/sb:topic <slug>` | Create or append to `topics/<slug>.md`. Use for studying (e.g., `/sb:topic crud`). Adds backlinks to any current-conversation context. |
| `/sb:tasks [--project <slug>] [--all]` | List pending kanban items. Default = current project. |
| `/sb:task add "<text>" [--project <slug>] [--due YYYY-MM-DD] [--tag …]` | Append to "To Do". |
| `/sb:task done <n\|prefix>` | Move task to "Done", stamp timestamp. |
| `/sb:kanban [--project <slug>] [--open]` | Print board to terminal; `--open` invokes `obsidian open file=projects/<slug>/kanban.md`. |
| `/sb:connect [--current]` | Suggest links between the current conversation/lesson and existing notes (tag overlap + keyword similarity). Interactive accept/reject; on accept, writes/updates `connections/<theme>.md`. |
| `/sb:tag [path?]` | Run auto-tagger on a note (or all unanalyzed). Updates frontmatter `tags:` and the `tags.md` index. |
| `/sb:search <query>` | Thin wrapper over `obsidian vault=ai-mind search query="..."`. |
| `/sb:project [<slug>]` | List projects with stats; with slug, prints that project's INDEX.md. |
| `/sb:backfill [--days N\|--all]` | One-shot import of historical JSONLs from `~/.claude/projects/`. Not run automatically (per user decision). |

### 4. Analyzer prompt contract

`lib/analyzer.js` invokes:
```
claude -p --model claude-haiku-4-5-20251001 --output-format json
```
with a system-prompt-pinned schema:
```json
{
  "summary": "1-3 sentence TL;DR",
  "lessons": [{"title": "...", "body": "...", "tags": []}],
  "takeaways": ["..."],
  "action_items": [{"text": "...", "tags": [], "due": null}],
  "suggested_tags": ["..."],
  "suggested_topics": ["..."]   // existing topic notes this convo enriches
}
```
The analyzer streams the parsed JSON back into vault writes. Failure mode: write `_meta/analysis-errors.log` and leave `analyzed: false` so it's retried next run.

### 5. Auto-tagging

Two-layer:
- **Rules** (`_meta/tag-rules.json`): map keywords → canonical tag (`postgres|psql|pg → #db/postgres`). Editable.
- **LLM**: analyzer's `suggested_tags` are merged in. New tags are added to `tags.md` index.

Applied at:
- Conversation capture (lightweight rules pass)
- Analysis (LLM-augmented)
- Manual via `/sb:tag <path>`

### 6. Cross-project connections

After analysis, `connector.js` runs against the new lesson:
1. Find existing notes sharing ≥2 tags or ≥3 distinct ≥5-char keywords.
2. Score by tag overlap × recency.
3. Top-5 candidates are surfaced by `/sb:connect`; user accepts → MOC note `connections/<auto-theme>.md` is created/updated with backlinks both ways.

## Critical files to create

- `~/.claude/skills/sb/SKILL.md`
- `~/.claude/skills/sb/lib/{vault,jsonl,markdown,analyzer,tagger,kanban,connector}.js`
- `~/.claude/skills/sb/commands/{status,analyze,lesson,topic,tasks,task,kanban,connect,tag,search,project,backfill}.md`
- `~/.claude/hooks/sb-capture.js`
- `~/.claude/hooks/sb-plan-mirror.js`
- `~/.claude/hooks/sb-session-start.js`
- `~/Documents/vaults/ai-mind/templates/{conversation,project-index,kanban,lesson,topic}.md`
- `~/Documents/vaults/ai-mind/_meta/{session-map.json,tag-rules.json}` (seeded)

## Critical files to modify

- `~/.claude/settings.json` — register the three hooks under existing `hooks` block (PostToolUse + Stop + SessionStart).
- `~/.claude/CLAUDE.md` — add a "Second Brain" section pointing at the skill.

## Reuse from existing infrastructure

- `~/.claude/skills/graphify/SKILL.md` — proven skill frontmatter pattern (`name`, `description`, `trigger`).
- `~/.claude/skills/my_code/` — sub-command file layout (`git-commit.md`, `code-review.md`) — same pattern for `commands/*.md`.
- `~/.claude/hooks/gsd-check-update.js` — node hook pattern: read `cwd`/`homedir`, write JSON state under `~/.claude/cache/`, use `child_process.spawn` for background work.
- Obsidian CLI (`/usr/bin/obsidian` → `~/.local/bin/obsidian` after Register) — `obsidian vault=ai-mind <cmd>` is the primary read/write surface for any UI-coupled actions (open notes, search). File writes still go directly to disk for speed.
- Obsidian Kanban plugin format (the user has `obsidian-kanban` installed in `my_vault`'s plugin list — install in `ai-mind` too so boards render).

## Implementation order

1. **Skeleton + capture** — `SKILL.md`, `lib/vault.js`, `lib/jsonl.js`, `lib/markdown.js`, `sb-capture.js`, hook registration. End state: every Stop event writes a conversation file with frontmatter.
2. **Projects + plan mirror** — `sb-session-start.js` (scaffolds project dir), `sb-plan-mirror.js`, `/sb:project`, `/sb:status`. End state: `projects/<slug>/` exists with INDEX/kanban/lessons; plans mirror automatically.
3. **Kanban + tasks** — `lib/kanban.js`, `/sb:tasks`, `/sb:task add|done`, `/sb:kanban`. End state: project-scoped task board CRUD from slash commands.
4. **Analyzer + auto-tagger** — `lib/analyzer.js`, `lib/tagger.js`, `/sb:analyze`, `/sb:tag`, `/sb:lesson`. End state: `/sb:analyze` turns unprocessed conversations into lessons/takeaways/tasks/tags.
5. **Topics + connections** — `/sb:topic`, `lib/connector.js`, `/sb:connect`. End state: cross-project knowledge graph.
6. **Polish** — `/sb:backfill`, `/sb:search`, `tags.md` rebuilder, CLAUDE.md doc. Defer until 1–5 settled.

## Verification (per phase)

| Phase | How to verify |
|---|---|
| 1 | Open a new Claude Code session in `~/tmp/sb-test/`, exchange a few turns, exit. Check `ai-mind/conversations/sb-test/*.md` exists with valid frontmatter. Resume the session, exchange more turns, exit. Check the same file got a `## Resume …` block appended (no duplicate file). |
| 2 | `ls ai-mind/projects/sb-test/` shows INDEX/kanban/lessons. Touch `~/.claude/plans/foo.md`; check `ai-mind/projects/sb-test/plans/foo.md` appears. |
| 3 | `/sb:task add "write tests"` → `cat ai-mind/projects/sb-test/kanban.md` shows it under To Do. `/sb:task done 1` moves it to Done. `/sb:tasks` lists pending across projects. |
| 4 | `/sb:analyze` on the test conversation produces `lessons/<date>-<slug>.md` and updates `projects/sb-test/lessons.md`. Frontmatter `analyzed: true`. Action items from the conversation land in kanban "To Do". `tags.md` index shows new tags. |
| 5 | `/sb:topic crud` creates `topics/crud.md` and backlinks the current conversation. `/sb:connect --current` suggests at least 1 link if there's another note sharing tags. |
| 6 | `/sb:backfill --days 7` imports recent JSONLs; spot-check 2 conversations. `/sb:search "kanban"` returns the test board. |

## Open extensions (deferred — "add as we go")

- Embeddings-based connector (replace keyword overlap with Smart-Connections-style cosine similarity).
- Weekly digest command (`/sb:weekly` — synthesizes the week's lessons into a brain note).
- Per-tag dashboards (`/sb:tag-view db/postgres`).
- Action-item due-date reminders via `omarchy reminder`.
- Integration with `obsidian eval` for richer in-vault queries (Dataview-style).
- MCP server exposing the vault to other Claude Code sessions.

## Defaults baked in (per user decisions)

- Analyzer engine: `claude -p` headless (no API key needed; pinned to Haiku for cost).
- Backfill: not automatic; only new sessions captured. `/sb:backfill` available on demand.
- Vault: `ai-mind` (the existing scratch vault, repurposed).
- Project identity: `cwd` at session start. Locked for the lifetime of the session.
