# sb — second-brain skill

A persistent second-brain skill for [Claude Code](https://claude.com/claude-code) that captures every conversation into an [Obsidian](https://obsidian.md/) vault, scopes notes by project, and lets you analyze conversations into lessons, takeaways, action items, kanban tasks, topic notes, and cross-project connections.

Part of [claude-skills-pack](../../README.md). Ships with its own installer and is fully usable standalone.

See [`docs/PLAN.md`](./docs/PLAN.md) for the original design and [`docs/PHASE9_PLAN.md`](./docs/PHASE9_PLAN.md) for the in-flight numeric-folders refactor.

---

## What you get

- Every Claude Code conversation auto-saved to `<vault>/conversations/<project>/<session>.md` with frontmatter (session id, project, model, start/end times, turn count).
- `/resume` continues into the same file (no duplicates).
- One project per `cwd` — each gets its own `INDEX.md`, `kanban.md`, `lessons.md`, and a `plans/` mirror of `~/.claude/plans/`.
- Slash commands: `/sb:status`, `/sb:analyze`, `/sb:lesson`, `/sb:topic`, `/sb:tasks`, `/sb:task add|done`, `/sb:kanban`, `/sb:connect`, `/sb:tag`, `/sb:search`, `/sb:project`, `/sb:backfill`.
- Auto-tagging (rules + LLM-suggested).
- Cross-project connection notes (MOC-style).

---

## Prerequisites

| Requirement | Why | How to get it |
|---|---|---|
| Claude Code installed | the host | https://claude.com/claude-code |
| Node.js ≥ 18 | hooks are nodejs | `pacman -S nodejs` / `brew install node` / etc. |
| Obsidian desktop app | vault frontend | https://obsidian.md/ — on Arch, use AUR `obsidian-appimage` (the `obsidian` package's electron wrapper breaks the CLI register) |
| Obsidian CLI registered | scripted vault access | In Obsidian app: **Settings → General → Command line interface → Register**. Verify `~/.local/bin/obsidian` exists. |
| `~/.local/bin` in `PATH` | so `obsidian` resolves to the CLI, not the GUI | `export PATH="$HOME/.local/bin:$PATH"` in `~/.zshrc` / `~/.bashrc` |
| An Obsidian vault for the brain | storage | This skill defaults to a vault named `ai-mind` at `~/Documents/vaults/ai-mind/`. Create one in the app or via `mkdir -p ~/Documents/vaults/ai-mind && obsidian` and pick "Open folder as vault". |
| (Optional) Obsidian Kanban community plugin | for board rendering | Install from Community Plugins inside the app. The `.md` boards work without it; the plugin just makes them pretty. |

---

## Install (human — fresh Claude Code box)

```bash
# 1. Clone or copy this directory somewhere
git clone <repo-url> ~/secondbrain_obsidian_claude
cd ~/secondbrain_obsidian_claude

# 2. Run the installer (will be added — see "Implementation status" below)
./install.sh
```

Until `install.sh` lands, install manually:

```bash
# 2a. Skill files
mkdir -p ~/.claude/skills/sb/{lib,commands}
cp -r skill/* ~/.claude/skills/sb/

# 2b. Hooks
cp hooks/sb-capture.js       ~/.claude/hooks/
cp hooks/sb-plan-mirror.js   ~/.claude/hooks/
cp hooks/sb-session-start.js ~/.claude/hooks/

# 2c. Slash command symlinks
mkdir -p ~/.claude/commands/sb
for f in ~/.claude/skills/sb/commands/*.md; do
  ln -sf "$f" ~/.claude/commands/sb/"$(basename "$f")"
done

# 2d. Vault scaffold
VAULT=~/Documents/vaults/ai-mind
mkdir -p "$VAULT"/{conversations,projects,lessons,topics,connections,inbox,templates,_meta}
cp vault-templates/* "$VAULT/templates/"
echo '{}'  > "$VAULT/_meta/session-map.json"
cp tag-rules.seed.json "$VAULT/_meta/tag-rules.json"
```

### 3. Register the hooks in `~/.claude/settings.json`

Merge this into the `hooks` block (preserving any existing entries):

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"/home/<you>/.claude/hooks/sb-session-start.js\"" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node \"/home/<you>/.claude/hooks/sb-capture.js\"", "timeout": 10 } ] }
    ],
    "SubagentStop": [
      { "hooks": [ { "type": "command", "command": "node \"/home/<you>/.claude/hooks/sb-capture.js\"", "timeout": 10 } ] }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command",
            "command": "node \"/home/<you>/.claude/hooks/sb-plan-mirror.js\"",
            "if": "Edit(/home/<you>/.claude/plans/**)",
            "timeout": 5 }
        ]
      }
    ]
  }
}
```

Replace `<you>` with your username (or use `$HOME` expansion in your installer).

### 4. (Optional) Reference the skill in your global instructions

Add to `~/.claude/CLAUDE.md`:

```markdown
## Second Brain (sb)

The `sb` skill auto-captures conversations into the `ai-mind` Obsidian vault.
Use `/sb:status` to see project state, `/sb:analyze` to mine lessons,
`/sb:task add "…"` to capture todos, `/sb:topic <name>` for study notes.
```

### 5. Verify

```bash
# Open a fresh Claude Code session in a new project dir
mkdir -p ~/tmp/sb-smoketest && cd ~/tmp/sb-smoketest && claude

# Have a 2-3 turn conversation, exit.
# Then in your shell:
ls ~/Documents/vaults/ai-mind/conversations/sb-smoketest/
ls ~/Documents/vaults/ai-mind/projects/sb-smoketest/

# Should see <session-uuid>__<slug>.md and INDEX.md/kanban.md/lessons.md.
```

---

## Install (Claude — telling another Claude Code instance to install this for itself)

Paste this prompt into a fresh Claude Code session, after cloning this repo:

> Install the secondbrain_obsidian_claude skill from `./` into my Claude Code config. Read README.md and PLAN.md, then:
> 1. Copy the skill files to `~/.claude/skills/sb/` (with `lib/` and `commands/` subdirs).
> 2. Copy the three hook scripts to `~/.claude/hooks/`.
> 3. Symlink the slash-command files to `~/.claude/commands/sb/`.
> 4. Scaffold the vault directories under `~/Documents/vaults/ai-mind/` and seed `_meta/session-map.json` (`{}`) and `_meta/tag-rules.json` (from `tag-rules.seed.json`).
> 5. Merge the hook registrations into `~/.claude/settings.json` (preserve existing hooks; expand `$HOME` to the absolute path; do not destroy any other config).
> 6. Verify by opening a test session in `~/tmp/sb-smoketest/`, having a brief exchange, then checking that `~/Documents/vaults/ai-mind/conversations/sb-smoketest/` contains a `.md` file with valid frontmatter.
> 7. Stop and report what changed.
>
> Prerequisites to check first (and tell me to fix if missing): `node --version` ≥ 18; `~/.local/bin/obsidian` exists (CLI registered); `~/Documents/vaults/ai-mind/` exists as an Obsidian vault.
> Do NOT delete the existing vault contents, and do NOT modify any hook entries that aren't related to this skill.

---

## Layout

```
secondbrain_obsidian_claude/
├── README.md                 # this file
├── PLAN.md                   # full design (architecture, components, phases)
├── install.sh                # one-shot installer (TODO)
├── skill/                    # → installed to ~/.claude/skills/sb/
│   ├── SKILL.md
│   ├── lib/
│   │   ├── vault.js
│   │   ├── jsonl.js
│   │   ├── markdown.js
│   │   ├── analyzer.js
│   │   ├── tagger.js
│   │   ├── kanban.js
│   │   └── connector.js
│   └── commands/
│       ├── status.md
│       ├── analyze.md
│       ├── lesson.md
│       ├── topic.md
│       ├── tasks.md
│       ├── task.md
│       ├── kanban.md
│       ├── connect.md
│       ├── tag.md
│       ├── search.md
│       ├── project.md
│       └── backfill.md
├── hooks/                    # → installed to ~/.claude/hooks/
│   ├── sb-capture.js
│   ├── sb-plan-mirror.js
│   └── sb-session-start.js
├── vault-templates/          # → installed to <vault>/templates/
│   ├── conversation.md
│   ├── project-index.md
│   ├── kanban.md
│   ├── lesson.md
│   └── topic.md
├── tag-rules.seed.json       # → <vault>/_meta/tag-rules.json
└── settings-snippet.json     # hook entries to merge into ~/.claude/settings.json
```

---

## User Guide

### Mental model

There are **three layers** of knowledge in the vault:

1. **Conversations** (raw) — every Claude Code session, captured automatically. Lives under `conversations/<project>/`. You rarely edit these directly.
2. **Projects** (scoped) — one per `cwd`. Each has an `INDEX.md` dashboard, a `kanban.md` task board, a `lessons.md` rollup, and a `plans/` archive. Created automatically the first time you run Claude in that directory.
3. **Knowledge** (cross-cutting) — `lessons/` (insights worth remembering), `topics/` (study notes on subjects like "CRUD", "observability"), `connections/` (MOCs that link across projects). You build these up via slash commands.

You don't have to think about layers 1 and 2 — they happen. You spend your time on layer 3 via `/sb:analyze`, `/sb:lesson`, `/sb:topic`, and `/sb:connect`.

### The daily loop

A typical day:

```text
morning   →  cd ~/projects/my-thing && claude        # session starts, auto-captured
              /sb:status                              # see pending tasks + recent lessons
              /sb:tasks                               # what's on the board for this project?
              … work …
              /sb:task add "fix the N+1 query"        # capture todo as it comes up
              … work …
              /sb:lesson "django select_related vs prefetch_related"
                                                      # snapshot insight while it's fresh
end of day →  exit claude                             # conversation file written
              /sb:analyze                             # mine today's chats for lessons/actions/tags
              /sb:connect --current                   # suggest links to related notes

weekly    →  /sb:topic kanban-flow                    # build study note from accumulated lessons
              /sb:search "deadlock"                   # find past insights
              open Obsidian, browse the graph
```

### Command reference (with examples)

#### `/sb:status`
One-screen project + brain state.
```
$ /sb:status
Project: my-thing  (/home/you/projects/my-thing)
  Conversations: 12 total, 3 un-analyzed
  Tasks:         5 To Do, 1 Doing, 18 Done
  Plans:         2 mirrored
  Lessons:       7 captured

Across all projects:
  Un-analyzed conversations: 8
  Open tasks:                23
  Recent lessons (last 7d):  4
```

#### `/sb:analyze [session_id?]`
Mine un-analyzed conversations into structured knowledge. With no arg, processes every conversation where frontmatter `analyzed: false`.
```
$ /sb:analyze
Processing 3 conversations…
  ✓ 41ad…: 2 lessons, 4 takeaways, 3 action items, 6 tags
  ✓ 8b89…: 1 lesson,  2 takeaways, 0 action items, 4 tags
  ✓ 5a6e…: 0 lessons, 1 takeaway,  1 action item,  2 tags
Wrote:
  lessons/2026-05-24-django-prefetch.md
  lessons/2026-05-24-redis-key-design.md
  projects/my-thing/lessons.md  (+3 entries)
  projects/my-thing/kanban.md   (+4 To Do)
  tags.md                       (+2 new tags)
```
Each conversation goes through Claude Haiku via `claude -p` with a JSON schema. Costs roughly $0.001–0.01 per conversation depending on length.

#### `/sb:lesson "<title>"`
Manually capture a lesson from the **current** running conversation. Use when something clicks mid-session and you don't want to wait for `/sb:analyze`.
```
/sb:lesson "redis SCAN beats KEYS for production scans"
```
Creates `lessons/<today>-redis-scan-beats-keys.md` and links it to the active conversation.

#### `/sb:topic <slug>`
Create or extend a study/topic note. Topics are evergreen reference (think Zettelkasten permanent notes).
```
/sb:topic crud              # → topics/crud.md
/sb:topic event-sourcing
/sb:topic kubernetes-networking
```
If the topic doesn't exist, scaffolded from `templates/topic.md`. If it exists, the current conversation is appended as a "Source: [[conv-link]]" entry and any new insight from this session gets merged into the body.

#### `/sb:tasks [--project <slug>] [--all]`
Default: pending tasks for the **current** project.
```
$ /sb:tasks
my-thing — To Do:
  1. fix the N+1 query                    #db/performance
  2. add retry to the webhook sender      due:2026-05-30
  3. write the migration runbook
  4. investigate slow GraphQL resolver
  5. upgrade pg driver

$ /sb:tasks --all
  my-thing (5):     fix the N+1 query, …
  other-project (2): …
```

#### `/sb:task add "<text>" [--project <slug>] [--due YYYY-MM-DD] [--tag <t>]`
```
/sb:task add "investigate connection pool exhaustion" --tag db --due 2026-05-30
/sb:task add "ship the v2 redesign" --project frontend
```
Appended to `projects/<slug>/kanban.md` under `## To Do`.

#### `/sb:task done <n|prefix>`
Move task to Done. Accepts either the index from `/sb:tasks` output or a unique prefix of the task text.
```
/sb:task done 2
/sb:task done "investigate"
```

#### `/sb:kanban [--project <slug>] [--open]`
Print the markdown kanban to the terminal. `--open` invokes `obsidian open` so it opens visually in the app (with the Kanban plugin it renders as columns).
```
/sb:kanban
/sb:kanban --project frontend --open
```

#### `/sb:connect [--current]`
Suggest links between the current conversation/lesson and existing notes. Uses tag overlap + keyword similarity.
```
$ /sb:connect --current
Candidates (top 5):
  [1] lessons/2026-04-12-postgres-connection-pool.md   (3 shared tags, 0.71)
  [2] topics/observability.md                          (2 shared tags, 0.62)
  [3] projects/other-thing/lessons.md                  (2 shared tags, 0.51)
  [4] lessons/2026-03-18-redis-cluster-failover.md     (1 shared tag,  0.44)
  [5] lessons/2026-02-01-grpc-deadline-propagation.md  (1 shared tag,  0.40)
Accept which? (e.g. "1 2 4", "all", "none")
```
Accepted links go into `connections/<auto-theme>.md` with bidirectional backlinks.

#### `/sb:tag [path?]`
Run the auto-tagger. With no arg, tags every untagged note. With a path, tags just that file.
```
/sb:tag
/sb:tag lessons/2026-05-24-django-prefetch.md
```
Tags come from two sources: keyword rules (`_meta/tag-rules.json` — editable) and LLM suggestions from the analyzer.

#### `/sb:search <query>`
Thin wrapper over `obsidian vault=ai-mind search`. Uses Obsidian's full-text index (faster + smarter than grep).
```
/sb:search "deadlock"
/sb:search "tag:#db/postgres"
/sb:search "path:projects/my-thing"
```

#### `/sb:project [<slug>]`
With no arg: lists all projects with stats. With slug: prints that project's `INDEX.md`.
```
$ /sb:project
PROJECT           CONVS  TASKS  LESSONS  LAST
my-thing             12      5        7  2026-05-24
frontend              8      3        4  2026-05-22
secondbrain_…         3      1        2  2026-05-24

$ /sb:project my-thing
# my-thing
…dashboard content…
```

#### `/sb:backfill [--days N | --all]`
One-shot import of historical conversations from `~/.claude/projects/*.jsonl` into the vault. **Not run automatically** — you opt in.
```
/sb:backfill --days 30          # import last month of chats
/sb:backfill --all              # import everything (can be hundreds of MB)
```

### Workflows by goal

**"I just learned something — capture it"**
```
/sb:lesson "<one-line title>"      ← while session is active
# or later:
/sb:analyze                        ← extracts lessons from all recent chats at once
```

**"What was that thing I figured out last week?"**
```
/sb:search "<keyword>"
# or browse:
obsidian vault=ai-mind open file=lessons/2026-05-17-…
```

**"I'm studying CRUD / observability / k8s — build a reference"**
```
/sb:topic crud                     ← create or append
# work through several sessions, each time:
/sb:topic crud                     ← appends current-session context to the topic note
```

**"What do I have on my plate?"**
```
/sb:status
/sb:tasks --all
```

**"Find the through-line across my projects"**
```
/sb:connect --current              ← while a relevant convo/lesson is open
/sb:search "tag:#<some-tag>"
# In Obsidian: open the graph view, filter by tag
```

**"Throw an idea on the pile"**
```
/sb:task add "<idea>" --tag idea
# or for bigger raw dumps:
echo "<thought>" >> ~/Documents/vaults/ai-mind/inbox/$(date +%F).md
```

### What gets captured vs ignored

| Captured | Ignored |
|---|---|
| User messages | System reminders |
| Assistant text replies | Tool result payloads (kept as a one-line summary) |
| Slash command invocations | File-history snapshots |
| `/resume` continuations | Subagent internal chatter (unless `--include-subagents`) |
| Tool names + brief args | Hook output |

You can review what a conversation file looks like before trusting it — check `~/Documents/vaults/ai-mind/conversations/<any-project>/<any-session>.md`.

### Tips

- **Disable for one session**: `SB_DISABLE=1 claude`
- **Edit the tag rules**: `~/Documents/vaults/ai-mind/_meta/tag-rules.json` — JSON map of `"keyword|regex": "#tag/name"`. Reloaded on every analyzer run.
- **Custom analyzer prompt**: drop `prompts/analyzer.md` in the skill dir to override the default extraction prompt.
- **Vault not on default path?** Set `SB_VAULT_PATH=/your/path` in your shell rc.
- **Bigger model for analysis**: `SB_ANALYZER_MODEL=claude-sonnet-4-6` for higher-quality lessons at higher cost.
- **Where do plan files go?** Anything you write under `~/.claude/plans/*.md` is auto-mirrored to `projects/<current>/plans/`. Plans are scoped to the project you were in when you wrote them.
- **`/resume` works**: the capture hook detects the existing conversation file by `sessionId` and appends under a `## Resume YYYY-MM-DD HH:MM` separator. Frontmatter `last_updated` and `turn_count` are refreshed.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No files appearing in `conversations/` | Hook not firing | Check `~/.claude/settings.json` has the `sb-capture.js` Stop hook. Run `node ~/.claude/hooks/sb-capture.js < /dev/null` — should not error. |
| `obsidian: command not found` | CLI not registered or PATH wrong | Re-do Obsidian → Settings → General → Command line interface → Register. Then `ls ~/.local/bin/obsidian`. Add `~/.local/bin` to PATH. |
| `obsidian` opens the GUI instead of running a command | You're using the Arch `obsidian` package (electron wrapper) | Switch to AUR `obsidian-appimage`. See Prerequisites. |
| `/sb:analyze` fails with "claude: command not found" | `claude` CLI not in PATH for the hook environment | Add `claude` to PATH in your shell rc, or set `SB_CLAUDE_BIN=/abs/path/to/claude`. |
| Kanban renders as plain markdown | Obsidian Kanban plugin not installed in `ai-mind` | Open vault → Community plugins → install "Kanban". |
| Analysis is too slow / too expensive | Default is Haiku, which is fast and cheap; long conversations still cost | Set `SB_ANALYZER_MAX_TURNS=40` to truncate, or `SB_ANALYZER_MODEL=claude-haiku-4-5-20251001` (already default). |
| Conversation file has duplicate turns after `/resume` | The dedupe logic uses the JSONL byte offset stored in `_meta/session-map.json`. If the map got corrupted, delete the entry for that session and re-run; it will rewrite from scratch. |

---

## Configuration

Override defaults via env vars (read by all hooks and `lib/vault.js`):

| Var | Default | Purpose |
|---|---|---|
| `SB_VAULT_PATH` | `~/Documents/vaults/ai-mind` | Where the brain lives |
| `SB_VAULT_NAME` | `ai-mind` | Vault name used by `obsidian vault=…` CLI calls |
| `SB_ANALYZER_MODEL` | `claude-haiku-4-5-20251001` | Model passed to `claude -p` |
| `SB_CAPTURE_DEBOUNCE_MS` | `5000` | Minimum gap between conversation-file writes |
| `SB_DISABLE` | unset | Set to `1` to suppress all sb hooks for one session |

---

## Uninstall

```bash
rm -rf ~/.claude/skills/sb
rm -f  ~/.claude/hooks/sb-capture.js
rm -f  ~/.claude/hooks/sb-plan-mirror.js
rm -f  ~/.claude/hooks/sb-session-start.js
rm -rf ~/.claude/commands/sb
# Then manually remove the sb-* entries from ~/.claude/settings.json hooks block.
# Vault contents are left untouched.
```

---

## Implementation status

| Component | Status |
|---|---|
| PLAN.md | ✅ written |
| README.md | ✅ written (this file) |
| `skill/SKILL.md` | ⬜ TODO |
| `skill/lib/*.js` | ⬜ TODO |
| `skill/commands/*.md` | ⬜ TODO |
| `hooks/*.js` | ⬜ TODO |
| `vault-templates/*.md` | ⬜ TODO |
| `tag-rules.seed.json` | ⬜ TODO |
| `settings-snippet.json` | ⬜ TODO |
| `install.sh` | ⬜ TODO |

Build phases (from PLAN.md):
1. Skeleton + capture
2. Projects + plan mirror
3. Kanban + tasks
4. Analyzer + auto-tagger
5. Topics + connections
6. Polish (backfill, search, docs)

---

## Development (source repo ⇄ installed copy)

This repo (`skills/sb/`) is the canonical source. The **installed** copy at
`~/.claude/skills/sb/` (plus hooks at `~/.claude/hooks/sb-*.js`) is what actually runs,
and in practice it's the working copy you edit and test against a live vault.

Two scripts keep them in sync:

| Direction | Script | What it does |
|---|---|---|
| repo → installed | `./install.sh` | Full install: copies skill files + hooks, symlinks commands, jq-merges `settings-snippet.json`, scaffolds the vault. |
| installed → repo | `./dev-sync.sh` | Reverse mirror of the code you edited in place (`SKILL.md`, `lib/*.js`, `commands/*.md`, `commands/_runners/*.js`, `hooks/sb-*.js`) back into this repo so it can be committed. |

`dev-sync.sh` is **additive/overwrite only** — it never deletes, and it never touches
repo-authored plumbing (`install.sh`, `settings-snippet.json`, `README.md`, `docs/`,
`prompts/`, `bin/`, `vault-templates/`, seeds). Typical loop:

```bash
# edit + test in ~/.claude/skills/sb/ against a scratch vault …
./dev-sync.sh          # mirror the edits back into this repo
git checkout -b feat/…  # never commit to main
git add -A && git commit
```

---

## License & contributions

Personal project — fork freely. Plan & README live in this repo; the installed copies under `~/.claude/` are derived artifacts and should not be edited directly (re-run installer instead).
