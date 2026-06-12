# ADR 0001: Monorepo layout for claude-skills-pack

- **Date:** 2026-06-12
- **Status:** Accepted

## Context

The repo originally shipped only the `sb` (second-brain) skill. Three personally-authored Claude Code skills are now in scope:

- `sb` — second-brain (264K, 22 commands, 5 hooks, 9 libs)
- `code_assist` — git commit / code review / phase journal router (68K, 7 commands, 3 subagents)
- `unabridged` — forces complete output (28K, 1 hook, 0 commands)

Goals:
1. Each skill must be **installable standalone** — clone the repo and run `./skills/<name>/install.sh`.
2. The whole pack must be **installable as a bundle** — one top-level `./install.sh`.
3. Each skill must carry its own external dependencies (subagents, hooks) inside its subtree, so copying a single subdirectory into another repo is sufficient to ship it.

## Decision

Single Git repo, **monorepo of skills**, with this shape:

```
claude-skills-pack/
├── README.md          # bundle-level overview + install matrix
├── LICENSE            # MIT
├── install.sh         # interactive selector; delegates to per-skill installers
├── uninstall.sh       # delegates to per-skill uninstallers
└── skills/
    ├── sb/                  # self-contained
    ├── code_assist/         # self-contained (includes agents/, commands/)
    └── unabridged/          # self-contained (includes hooks/, settings-snippet.json)
```

Each `skills/<name>/` has:
- `SKILL.md` — the skill body Claude Code loads
- `README.md` — user-facing docs for that skill
- `install.sh` / `uninstall.sh` — symlinks (or copies, for skills with hooks) into `~/.claude/{skills,commands,agents,hooks}/`
- Any required `agents/`, `commands/`, `hooks/`, `lib/`, `prompts/`, etc. live inside the skill dir

Rationale:
- **Single source of truth.** Editing a skill in `~/.claude/skills/<name>/` after install is editing the repo (via the symlink), so changes are committable.
- **Reproducibility.** Anyone can clone the repo and reach an identical install with `./install.sh --all`.
- **Selective install.** A user who only wants `unabridged` clones the repo and runs `./skills/unabridged/install.sh`.
- **Future portability.** If a skill needs to leave the pack, `cp -r skills/<name> /elsewhere/` plus its own `install.sh` is a complete ship.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| One repo per skill | 3× the maintenance overhead; cross-skill changes (e.g. a shared install helper) would need coordinated PRs |
| Git submodules | Complexity for users; `git clone --recursive` failures are common; no benefit for skills that share no code |
| npm-style monorepo with workspaces | These skills have **zero** npm dependencies — workspaces are overkill |
| Keep `sb` in a dedicated repo and start a new one for `code_assist` + `unabridged` | Violates goal #2 (single bundle install) |

## Consequences

**Positive**
- New skills are added by `mkdir skills/<name> && touch skills/<name>/{SKILL.md,README.md,install.sh}` and adding `<name>` to the `SKILLS` array in the top-level `install.sh`.
- Git history is unified — easier to ship a release tagged across all skills.
- Per-skill READMEs let each skill have rich, focused documentation without bloating the top-level README.

**Negative**
- Repo size is larger (264K + 68K + 28K ≈ 360K). Negligible.
- A user who only wants one skill still clones the whole repo. Acceptable — `git clone` is cheap and `./skills/<name>/install.sh` is targeted.

**Neutral**
- The `sb` skill's pre-pack git history is **wiped** in the initial commit (user-confirmed). Backup tarball lives in `/tmp/claude-skills-pack-backup-<timestamp>.tar.gz` at restructure time.

## Usage

- **Adding a skill**: scaffold under `skills/<name>/`, write `SKILL.md`, `README.md`, `install.sh`, `uninstall.sh`. Add the name to the `SKILLS` array in the top-level `install.sh`. Document any subagents / hooks in the skill's README.
- **Updating a skill**: edit files in `skills/<name>/`. If installed via symlink, the live `~/.claude/skills/<name>/` reflects changes immediately.
- **Removing a skill**: `rm -rf skills/<name>/` and drop it from the top-level installer array. Users run `./skills/<name>/uninstall.sh` once before pulling the deletion (or accept dangling symlinks until they re-run the top-level uninstaller).
