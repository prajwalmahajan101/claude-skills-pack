# claude-skills-pack

A personal bundle of three [Claude Code](https://claude.com/claude-code) skills, each independently
installable - and, together, a **plugin marketplace** (`.claude-plugin/marketplace.json`).

| Skill | What it does | Slash commands | Agents | Hooks |
|---|---|---|---|---|
| [**sb**](./skills/sb) | Persistent second-brain - captures every Claude Code conversation into an Obsidian vault, analyzes them into lessons, kanban tasks, topics, and cross-project connections. **Self-healing:** idempotent vault-repair + project-linkage maintenance scripts and an optional auto lesson-mining hook. | 22 (`/sb:*`) | 0 | 5 + 2 (opt) |
| [**code_assist**](./skills/code_assist) | Developer-workflow powerhouse - atomic commits, stack-aware code review, journals, plan/debug/verify/ADR discipline, structure/release/onboard/refactor, **secure** (secret-scan + installable git-hooks), **incident** (hotfix + postmortem), github/jira/slack/sonar/graph integrations, and a **bidirectional memory bridge** (recall past lessons/risks). Zero-dep CLI + self-tests + subagents. | 37 (`/code_assist:*`) | 7 | 2 |
| [**unabridged**](./skills/unabridged) | Forces complete, untruncated output. No `// ...`, no "for brevity", no skeleton responses. | 0 (context skill) | 0 | 0 |

## As a plugin marketplace

```bash
claude plugin marketplace add <path-or-url-to-this-repo>
/plugin install code_assist@claude-skills-pack   # or sb@ / unabridged@
```

`./install.sh --all` also registers the marketplace; `./install.sh --marketplace` registers it
alone. The symlink installers and the plugin install are interchangeable.

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
│   └── marketplace.json  # lists the 3 plugins (sb, code_assist, unabridged)
├── install.sh            # top-level selector + marketplace registration
├── uninstall.sh
├── skills/
│   ├── sb/               # self-contained: SKILL.md, lib/, commands/, hooks/, install.sh, README.md
│   ├── code_assist/      # SKILL.md + families/ + agents/ + hooks/ + bridge/ + tests/ + .claude-plugin/
│   └── unabridged/       # SKILL.md + code/ + prose/ + continuation/ + EXAMPLES.md
└── docs/
    └── adr/              # architecture decision records
```

Each skill lives under `skills/<name>/` with its own `SKILL.md`, `README.md`, and `install.sh`. You can copy any one of them into another repo and ship it standalone - they share no code.

## Uninstall

```bash
./uninstall.sh           # removes all symlinks; never deletes source files or vault contents
# or per skill:
./skills/<name>/uninstall.sh
```

For `sb` specifically, your Obsidian vault is never touched - only the symlinks under `~/.claude/skills/sb`, `~/.claude/commands/sb`, `~/.claude/hooks/sb-*.js`, and the `sb-*` entries inside `~/.claude/settings.json` are removed.

## Per-skill READMEs

- [`skills/sb/README.md`](./skills/sb/README.md) - vault layout, slash command reference, configuration knobs
- [`skills/code_assist/README.md`](./skills/code_assist/README.md) - family routing, backbone CLI, agents, hooks, tests, bridge, plugin usage
- [`skills/unabridged/README.md`](./skills/unabridged/README.md) - trigger phrases, sub-skill anatomy, examples

## License

MIT - see [LICENSE](./LICENSE).
