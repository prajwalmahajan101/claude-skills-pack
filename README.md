# claude-skills-pack

A personal bundle of three fully-standalone [Claude Code](https://claude.com/claude-code) skills plus
an optional orchestrator that composes them - each independently installable, and together a **plugin
marketplace** (`.claude-plugin/marketplace.json`).

| Skill | What it does | Slash commands | Agents | Hooks |
|---|---|---|---|---|
| [**sb**](./skills/sb) | Persistent second-brain - captures every Claude Code conversation into an Obsidian vault, analyzes them into lessons, kanban tasks, topics, and cross-project connections. **Self-healing:** idempotent vault-repair + project-linkage maintenance and an optional auto lesson-mining hook. Holds knowledge via a generic `ingest` primitive (fully standalone). | `/sb:*` | 0 | 6 + 2 (opt) |
| [**code_assist**](./skills/code_assist) | Developer-workflow powerhouse - atomic commits, stack-aware code review (**blast-radius-grounded** via `graph review-prep`), journals, plan/debug/verify/ADR discipline, structure/release/onboard/refactor, **secure** (secret-scan + installable git-hooks), **incident** (hotfix + postmortem), github/jira/slack/sonar/graph integrations. Fully standalone. Zero-dep CLI + self-tests + subagents. | 37 (`/code_assist:*`) | 7 | 2 |
| [**unabridged**](./skills/unabridged) | Forces complete, untruncated output. No `// ...`, no "for brevity", no skeleton responses. | 0 (context skill) | 0 | 0 |
| [**sutra**](./skills/sutra) | **Orchestrator** - composes the three members behind one unified `/sutra:*` surface (and a `/sutra:do` general agent). Owns the capability registry, artifact interchange schema, cross-plugin recall, and the verify→lesson→recall feedback loop. Members stay standalone without it. | `/sutra:*` | 1 | 1 |

## Two ways to use the pack

1. **À la carte** - install any member(s) and use their own namespaces (`/code_assist:*`, `/sb:*`).
   Maximum isolation; no cross-plugin behavior. Removing a member never breaks another.
2. **Full pack** - also install **sutra**. Now `/sutra:commit` commits *and* journals *and* offers to
   capture a lesson; `/sutra:review` recalls prior risks and grounds severity in the call graph, then
   syncs to the vault; `/sutra:do <anything>` routes any request across the whole ecosystem.

## As a plugin marketplace

```bash
claude plugin marketplace add <path-or-url-to-this-repo>
/plugin install code_assist@claude-skills-pack   # or sb@ / unabridged@ / sutra@
```

`./install.sh --all` also registers the marketplace; `./install.sh --marketplace` registers it
alone.

> **Pick one hook-install method, not both.** The symlink installers (`install.sh`) and the plugin
> install (`/plugin install`) are interchangeable — each wires the same hooks, the first via
> `~/.claude/settings.json`, the second via each plugin's manifest (`plugin.json` → `hooks/hooks.json`).
> `install.sh` registers hooks through `settings.json` **only** and does not install the plugin
> manifest into the skill dir, so the symlink installer alone can't double-register. Running **both**
> methods for the same skill still double-registers its hooks, so they fire twice. Choose the
> marketplace flow **or** the symlink installer for a given skill; `./uninstall.sh` removes the
> symlink-install side if you switch.

## Install

Install everything:

```bash
git clone https://github.com/<you>/claude-skills-pack.git
cd claude-skills-pack
./install.sh --all
```

Install interactively (asks per skill):

```bash
./install.sh
```

Install one skill only:

```bash
./skills/sb/install.sh
# or
./install.sh sb code_assist
```

## Requirements

| Skill | Needs |
|---|---|
| **sb** | Node ≥ 18, [Obsidian desktop](https://obsidian.md/), Obsidian CLI registered, `jq` (optional, for auto-merge of `settings.json`), `claude` CLI on `$PATH` |
| **code_assist** | Node ≥ 18 (zero-dep `ca-tools.js` backbone + tests), `jq` (optional, for hook merge into `settings.json`), Claude Code (7 bundled subagents) |
| **unabridged** | Claude Code only |

Zero npm dependencies - all runtime code uses Node built-ins.

## Layout

```
claude-skills-pack/
├── .claude-plugin/
│   └── marketplace.json  # lists the 4 plugins (sb, code_assist, unabridged, sutra)
├── install.sh            # top-level selector + marketplace registration
├── uninstall.sh
├── skills/
│   ├── sb/               # self-contained: SKILL.md, lib/, commands/, hooks/, install.sh, README.md
│   ├── code_assist/      # SKILL.md + families/ + agents/ + hooks/ + tests/ + .claude-plugin/
│   ├── unabridged/       # SKILL.md + code/ + prose/ + continuation/ + EXAMPLES.md
│   └── sutra/            # SKILL.md + registry/ + schema/ + bridge/ + loop/ + commands/ + agents/ + tests/
└── docs/
    └── adr/              # architecture decision records
```

Each member skill lives under `skills/<name>/` with its own `SKILL.md`, `README.md`, and `install.sh`. The three members share **no code** and no cross-references - you can copy any one into another repo and ship it standalone. `sutra` is the optional layer that composes them.

## Uninstall

```bash
./uninstall.sh           # removes all symlinks; never deletes source files or vault contents
# or per skill:
./skills/<name>/uninstall.sh
```

For `sb` specifically, your Obsidian vault is never touched - only the symlinks under `~/.claude/skills/sb`, `~/.claude/commands/sb`, `~/.claude/hooks/sb-*.js`, and the `sb-*` entries inside `~/.claude/settings.json` are removed.

## Per-skill READMEs

- [`skills/sb/README.md`](./skills/sb/README.md) - vault layout, slash command reference, configuration knobs
- [`skills/code_assist/README.md`](./skills/code_assist/README.md) - family routing, backbone CLI, agents, hooks, tests, plugin usage
- [`skills/unabridged/README.md`](./skills/unabridged/README.md) - trigger phrases, sub-skill anatomy, examples
- [`skills/sutra/README.md`](./skills/sutra/README.md) - orchestrator: registry, interchange schema, bridges, unified surface

## License

MIT - see [LICENSE](./LICENSE).
