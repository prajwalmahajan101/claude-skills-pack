# Phase 9: folder restructure + Obsidian community plugins (mirror my_vault conventions)

> **Status:** Planned, not yet implemented. Sitting here for later review.
> Source: `~/.claude/plans/we-have-a-skill-starry-dewdrop.md` (Phase 9 section).

## Context

Vault was just wiped — clean slate to apply a real organization scheme. User wants the ai-mind vault to feel like their existing `my_vault`: numeric-prefixed top-level folders, Templater + Dataview-powered templates, periodic-notes for daily/weekly, Smart Connections for semantic recall in the sidebar, Kanban plugin renders the boards, etc.

The current ai-mind layout is functional but flat (`conversations/`, `projects/`, `lessons/`, `topics/`, …). Reorganize into the my_vault aesthetic (00_x, 01_x, …) and adopt the same community plugins so behavior in Obsidian matches the user's existing muscle memory. Smart Connections in particular gives semantic recall in the GUI sidebar without my having to build embeddings into the skill.

## New vault layout

```
ai-mind/
├── 00_Dashboard/              # NEW — landing pages
│   ├── Home.md                # Dataview-driven dashboard (replaces tags.md as default open)
│   ├── Today.md               # Daily review (periodic-notes auto-creates this)
│   └── This Week.md           # Weekly review (Templater target for /sb:weekly)
├── 01_Conversations/          # was conversations/ — auto-captured Claude sessions
│   └── <project-slug>/<session>.md
├── 02_Projects/               # was projects/
│   └── <project-slug>/
│       ├── INDEX.md           # Dataview-powered dashboard for this project
│       ├── kanban.md          # Obsidian-Kanban renderable board
│       ├── lessons.md         # rollup (appended by /sb:analyze)
│       ├── plans/             # mirrored from ~/.claude/plans/
│       └── tasks/             # rich task notes (moved from /tasks)
├── 03_Lessons/                # was lessons/ — atomic Zettel-style cross-cutting lessons
├── 04_Topics/                 # was topics/ — evergreen study/reference notes
├── 05_Tasks/                  # NEW — global Dataview index pulling 02_Projects/*/tasks/*
│   └── INDEX.md
├── 06_Connections/            # was connections/ — MOC notes
├── 07_Reviews/                # was reviews/ — auto-written by /sb:weekly + /sb:daily
│   ├── Daily/
│   └── Weekly/
├── 08_Insights/               # NEW — recurring-theme MOCs from /sb:insights
├── 09_Exports/                # was exports/
├── 99_Inbox/                  # was inbox/ — raw captures awaiting triage
├── _templates/                # Templater-syntax templates (was templates/)
├── _assets/                   # NEW — images / screenshots / excalidraw embeds
├── __scribble/                # NEW — scratch / WIP (my_vault calls this __scrible)
└── _meta/                     # config (session-map, tag-rules, aliases, project-aliases)
```

All numeric prefixes ensure consistent alphabetic ordering in the Obsidian file explorer, matching the user's existing my_vault habit (00_–12_).

## Required community plugins (documented in README; user installs via Obsidian Community Plugins panel)

| Plugin | Role in ai-mind |
|---|---|
| **dataview** | INDEX.md / Home.md queries (recent lessons, open tasks per project, tag frequencies, weekly counts). Essential. |
| **smart-connections** | **USER ASK** — embeds notes in `.smart-env/`, surfaces semantically related notes in sidebar while you read/write. Complements `/sb:recall` (which is lexical + scriptable) by adding GUI-side semantic recall. Free with local model, no API key required. |
| **templater-obsidian** | Dynamic date headers, navigation links, daily/weekly templates with `<% tp.date.now() %>`. |
| **obsidian-tasks-plugin** | Rich task syntax (`- [ ] task 📅 2026-06-01 ⏫ #tag`) + queryable from any note. Used in `05_Tasks/INDEX.md` for cross-project task views. |
| **obsidian-kanban** | Renders `02_Projects/*/kanban.md` as drag-drop board. |
| **periodic-notes** | Auto-creates `07_Reviews/Daily/<YYYY-MM-DD>.md` and `07_Reviews/Weekly/<YYYY-WNN>.md` from templates. |
| **tag-wrangler** | Bulk rename/merge tags from the tag panel (supplements `_meta/tag-aliases.json`). |
| **calendar** | Sidebar date picker → opens daily note. |
| **nldates-obsidian** | "tomorrow", "next friday" parsing in templates. |
| **callout-manager** + **obsidian-list-callouts** | Pretty admonitions for lesson sections (Context / Insight / Why It Matters). |
| **obsidian-excalidraw-plugin** | Diagrams in `_assets/`. |
| **homepage** | Pins `00_Dashboard/Home.md` as launch page. |

Optional: `omnisearch`, `excalibrain`, `tag-folder`, `colored-tags`, `obsidian-linter`.

## Templater + Dataview templates

All templates go to `_templates/` and use Templater syntax. Auto-generated files (analyzer output, conversation captures) bypass Templater and are written by skill scripts directly.

### `_templates/Daily Review.md` (used by periodic-notes for daily)
```markdown
---
type: daily-review
date: <% tp.date.now("YYYY-MM-DD") %>
tags: [daily]
---
# <% tp.date.now("dddd, MMMM Do YYYY") %>

<< [[<% tp.date.now("YYYY-MM-DD", -1) %>|Yesterday]] | [[<% tp.date.now("YYYY-MM-DD", 1) %>|Tomorrow]] >>

## Sessions today
```dataview
TABLE turn_count, project FROM "01_Conversations" WHERE last_updated >= date("<% tp.date.now("YYYY-MM-DD") %>") SORT last_updated DESC
```

## Lessons captured today
```dataview
LIST FROM "03_Lessons" WHERE date = date("<% tp.date.now("YYYY-MM-DD") %>")
```

## Tasks added today
```dataview
LIST FROM "02_Projects" WHERE created >= date("<% tp.date.now("YYYY-MM-DD") %>") AND type = "task"
```

## Notes


## Reflection

```

### `_templates/Weekly Review.md`
Same idea but pulls 7-day windows. Synthesized body comes from `/sb:weekly` (LLM), template provides scaffolding.

### `_templates/Lesson.md`
Already structured (7 sections from Phase 8a.1). Add a Dataview "## Backlinks" block.

### `_templates/Topic.md` — auto-listing related lessons via Dataview
```markdown
---
type: topic
slug: <% tp.file.title.toLowerCase().replace(/\s+/g, '-') %>
created: <% tp.date.now() %>
tags: [topic]
---

# <% tp.file.title %>

## Notes


## Related Lessons (auto)
```dataview
LIST FROM "03_Lessons" WHERE contains(related, "<% tp.file.title.toLowerCase() %>") OR contains(string(tags), "<% tp.file.title.toLowerCase() %>")
SORT date DESC
```

## Source Log

```

### `_templates/Task.md` — Tasks-plugin compatible
```markdown
---
type: task
project: PROJECT
status: open
created: <% tp.date.now() %>
due: <% tp.date.now("YYYY-MM-DD", 7) %>
tags: []
---
# <% tp.file.title %>

## Context

## Goal

## Sub-steps
- [ ] step one
- [ ] step two

## Blockers
None.

## Related

```

### `_templates/Project INDEX.md` — heavy on Dataview
```markdown
---
type: project-index
project: PROJECT
path: CWD
created: <% tp.date.now() %>
tags: [project]
---

# PROJECT

## Open tasks
```dataview
TASK FROM "02_Projects/PROJECT/tasks" WHERE !completed
```

## Recent lessons
```dataview
LIST FROM "03_Lessons" WHERE source_project = "PROJECT" SORT date DESC LIMIT 10
```

## Sessions
```dataview
TABLE turn_count, last_updated FROM "01_Conversations/PROJECT" SORT last_updated DESC LIMIT 5
```

## Plans
ls plans/

```

### `_templates/Home.md` — vault-wide dashboard
```markdown
---
type: dashboard
tags: [dashboard]
---

# ai-mind 🧠

## Today
[[<% tp.date.now("YYYY-MM-DD") %>]]

## Active projects
```dataview
TABLE WITHOUT ID file.link AS Project, length(file.outlinks) AS Links FROM "02_Projects" WHERE type = "project-index" SORT file.mtime DESC LIMIT 10
```

## Recent lessons
```dataview
LIST FROM "03_Lessons" SORT date DESC LIMIT 10
```

## Open tasks across all projects
```dataview
TASK FROM "02_Projects" WHERE !completed GROUP BY file.folder LIMIT 15
```

## Recurring themes
![[06_Connections/recurring-themes]]
```

## Code changes

| File | Change |
|---|---|
| `skill/lib/vault.js#paths` | Re-point all folder helpers to the numbered structure: `conversations → 01_Conversations`, `projects → 02_Projects`, `lessons → 03_Lessons`, `topics → 04_Topics`, `tasks → 02_Projects/<slug>/tasks` (not `05_Tasks` — that's the global INDEX), `connections → 06_Connections`, `reviews → 07_Reviews`, `inbox → 99_Inbox`, `templates → _templates`. |
| `skill/lib/vault.js#ensureDirs` | Update mkdir list to include all new dirs + `00_Dashboard`, `05_Tasks`, `08_Insights`, `_assets`, `__scribble`. |
| `skill/commands/_runners/*` | Audit all runners — they use `paths()` so should be automatic, but verify weekly.js / daily.js / insights.js write to the new locations (`07_Reviews/Weekly/`, `00_Dashboard/Today.md`, `08_Insights/recurring-themes.md`). |
| `hooks/sb-session-start.js` | Update template renders to use new folder names. |
| `install.sh` | Create the full numbered folder tree on first run. |
| `install.sh` (theming) | Also create `.obsidian/themes/`, copy `Encore` (+ optional `Omarchy`) from my_vault if available, and seed `appearance.json` with the my_vault-matching values (only when empty/missing). |
| `vault-templates/*.md` | Rewrite with Templater syntax. Add Dataview-driven Home.md, project INDEX.md, daily/weekly/topic/task templates. |
| `skill/bin/sb-migrate-folders.js` | **NEW** — one-shot script: detect old flat layout, move to new numbered layout. Idempotent (skip if already migrated, detect via presence of `01_Conversations/`). |
| `README.md` | New "Plugins" section listing the 12 community plugins with one-line install pointers. Smart Connections setup guide (local-embedding-only, no API key required). |
| `tag-aliases.seed.json` | No change. |

## Smart Connections specifics

- Embeddings stored in `<vault>/.smart-env/` (single-folder vault embeddings). User installs plugin via Community Plugins → Browse → "Smart Connections".
- **Default model**: `TaylorAI/bge-micro-v2` runs locally in-browser via Transformers.js — zero API cost, no network calls.
- Sidebar pane: "Smart View" surfaces top-N semantically related notes automatically while you read/write.
- "Smart Chat" optional — can be wired to Claude/OpenAI for in-vault Q&A. Not required; user can use `/sb:ask` from terminal for the same outcome.
- README documents that `.smart-env/` is gitignored if the user version-controls the vault.

## Theming

Mirror my_vault's visual identity so ai-mind feels familiar on first open.

**Target appearance** (from `~/Documents/vaults/my_vault/.obsidian/appearance.json`):
- Base mode: `obsidian` (dark)
- CSS theme: **Encore**
- Accent color: `#93b1a6` (muted sage)
- Alt theme available: **Omarchy** (installed, not active)
- No CSS snippets in use

**Source assets** (already on disk in my_vault):
- `~/Documents/vaults/my_vault/.obsidian/themes/Encore/` (`manifest.json`, `theme.css`)
- `~/Documents/vaults/my_vault/.obsidian/themes/Omarchy/` (optional, for theme-switching parity)

**install.sh additions** — insert between the `_meta` folder creation and the existing settings.json merge step:

1. `mkdir -p "$VAULT/.obsidian/themes"`.
2. For each of `Encore` and `Omarchy`: if `$VAULT/.obsidian/themes/<name>/` does not exist AND `~/Documents/vaults/my_vault/.obsidian/themes/<name>/` does, `cp -r` it across. Warn (non-fatal) if the source is missing — user can install via Settings → Appearance → Manage.
3. Write `$VAULT/.obsidian/appearance.json` only if the file is missing or contains `{}` (never overwrite a user-customized one):
   ```json
   { "accentColor": "#93b1a6", "cssTheme": "Encore", "theme": "obsidian" }
   ```
4. Leave `enabledCssSnippets` unset — my_vault has none.

**README addition** — rename the "Required community plugins" section to "Plugins & Appearance" and append:

> **Theme:** Encore (dark) with accent `#93b1a6`. `install.sh` copies the theme from `my_vault` if present; otherwise install via Obsidian → Settings → Appearance → Manage → search "Encore".

## Implementation order

1. **Vault path constants** — update `lib/vault.js#paths` and `ensureDirs` to new numbered layout.
2. **Templater + Dataview templates** — write all 6 new templates under `vault-templates/`.
3. **`install.sh`** — create full numbered folder tree, copy new templates.
4. **Migration script** — `skill/bin/sb-migrate-folders.js` for users with existing flat-layout vaults (also useful if user re-creates ai-mind later).
5. **`00_Dashboard/Home.md`** — install.sh writes it from template if missing.
6. **README** — plugins section + Smart Connections quickstart.
7. **Re-run install.sh** — wipes nothing (cp -n preserves existing); creates new dirs and templates.
8. **User manual step** — install the 12 community plugins via Obsidian's Community Plugins browser.
9. **Optional**: user runs `/sb:backfill --days N` to repopulate from JSONLs, now landing in `01_Conversations/`.

## Verification

| Test | How |
|---|---|
| New folder tree | `tree -L 2 ~/Documents/vaults/ai-mind/` shows `00_Dashboard, 01_Conversations, …, 99_Inbox, _templates, _assets, __scribble, _meta`. |
| Templates use Templater | `grep -l '<%' ~/Documents/vaults/ai-mind/_templates/*.md` returns all 6 templates. |
| Conversation lands in 01_ | Start a fresh Claude Code session, exit; new file under `01_Conversations/<slug>/`. |
| Lessons land in 03_ | `/sb:analyze` writes to `03_Lessons/<date>-<slug>.md`. |
| Kanban renders as board | Install Kanban plugin; open `02_Projects/<slug>/kanban.md` → columns visible. |
| Dataview INDEX works | Open `02_Projects/<slug>/INDEX.md` after a session → Dataview blocks render task / lesson / session lists. |
| Daily review auto-created | After installing periodic-notes + pointing it at `_templates/Daily Review.md` and folder `07_Reviews/Daily`, opening today's note via the calendar plugin creates it from the template. |
| Smart Connections sidebar | After plugin install + initial indexing, open any lesson note → "Smart View" pane shows ≥ 3 semantically related notes. |
| Home dashboard | Set `00_Dashboard/Home.md` as the Homepage-plugin landing page; on app launch Dataview blocks populate Active Projects, Recent Lessons, Open Tasks. |
| Theme matches my_vault | After `install.sh`, `cat ~/Documents/vaults/ai-mind/.obsidian/appearance.json` shows `cssTheme: "Encore"` + accent `#93b1a6`; opening the vault renders with sage accent and Encore typography. |

## Defaults baked in (Phase 9)

- **Folder ordering**: numeric prefixes `00_–99_` matching my_vault's convention; supporting dirs use `_` prefix (templates, assets) and `__` prefix (scribble) to sort to the end.
- **Templates**: Templater syntax required (templates won't expand if Templater isn't installed — but skill scripts write files directly without Templater, so capture still works without the plugin).
- **Smart Connections**: documented as required for semantic GUI recall; not required for the skill itself. Local embedding model (no API costs).
- **Migration**: a `sb-migrate-folders.js` runs idempotently; safe to re-run.
- **README will warn**: "without these plugins, the vault still works as plain markdown — you just lose the GUI niceties."
- **Theming**: install.sh seeds Encore theme + sage accent (`#93b1a6`) to match my_vault; only seeds when `appearance.json` is empty/missing, so user customizations are preserved on re-run.
