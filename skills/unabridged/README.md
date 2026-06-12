# unabridged

Force [Claude Code](https://claude.com/claude-code) to deliver **complete output**. No truncation, no placeholders, no "for brevity", no skeleton responses.

## What it does

Loads a set of rules into context that ban the model's default lazy patterns and installs a `PostToolUse` hook that mechanically rejects code files containing placeholder markers.

| Layer | Lives in | Enforces |
|---|---|---|
| **Behavioral rules** | `SKILL.md` + `code/SKILL.md` + `prose/SKILL.md` + `continuation/SKILL.md` | What patterns are banned and how to handle long outputs. |
| **Mechanical backstop** | `hooks/unabridged-postwrite.sh` + `scripts/check_placeholders.sh` | Greps every `Write`/`Edit` to a code file. If `// ...`, `// TODO`, `// rest of code`, etc. appears, the hook exits with code 2 and Claude is forced to fix the file. |
| **Examples** | `EXAMPLES.md` | Before/after pairs for ambiguous cases. |

## Triggers

The skill auto-activates from phrases like:
- "full file", "complete implementation", "no placeholders"
- "don't truncate", "unabridged", "whole thing"
- "every component", "all N of them"
- "no //... stubs", "no TODO stubs", "write it all out"
- "no skeleton"

You can also load it explicitly via the Skill tool.

## Install

```bash
./install.sh
```

This:
1. Symlinks `<repo>/skills/unabridged/` → `~/.claude/skills/unabridged`
2. Copies `hooks/unabridged-postwrite.sh` → `~/.claude/hooks/`
3. Merges a `PostToolUse` hook entry (matcher: `Write|Edit`) into `~/.claude/settings.json` using `jq` (idempotent — re-running won't duplicate entries)

If `jq` isn't installed, the script tells you to merge `settings-snippet.json` manually.

## Sub-skills

The hook fires on every `Write`/`Edit` to a source file (`.ts`, `.tsx`, `.js`, `.py`, `.go`, `.rs`, `.java`, …). Markdown and prose are skipped.

| Sub-skill | When to read it |
|---|---|
| `code/SKILL.md` | About to write code — banned code-block patterns and structural shortcuts |
| `prose/SKILL.md` | About to write prose — banned hedging phrases ("for brevity", "and so on", "as needed") |
| `continuation/SKILL.md` | Output approaching token limit — use `[PAUSED — X of Y complete]` protocol instead of compressing |

## Architecture

```
unabridged/
├── SKILL.md                  # top-level + quick check
├── EXAMPLES.md               # before/after pairs
├── code/SKILL.md             # code-channel rules
├── prose/SKILL.md            # prose-channel rules
├── continuation/SKILL.md     # token-limit handling
├── scripts/
│   └── check_placeholders.sh # the actual grep
├── hooks/
│   └── unabridged-postwrite.sh
└── settings-snippet.json     # hook registration for ~/.claude/settings.json
```

## Uninstall

```bash
./uninstall.sh
```

Removes the symlink, the hook script, and strips the `unabridged-postwrite` entry from `settings.json` (backs it up first).

## License

MIT — see [LICENSE](../../LICENSE).
