# CLAUDE.md — claude-skills-pack

Agent guide for this repo. Keep it short; see [`README.md`](./README.md) for the user-facing tour.

## What this is

A Claude Code **plugin marketplace** (`.claude-plugin/marketplace.json`) bundling four plugins, each a
directory under `skills/`:

| Plugin | Role | Namespace |
|---|---|---|
| `code_assist` | developer-workflow powerhouse (commit, review, plan, debug, verify, ADR, …) | `/code_assist:*` |
| `sb` | second-brain — captures conversations into an Obsidian vault | `/sb:*` |
| `unabridged` | complete-output discipline (context skill, no commands) | — |
| `sutra` | **orchestrator** — composes the other three | `/sutra:*` |

## The one rule that shapes everything: independence

The three **members** (`code_assist`, `sb`, `unabridged`) are **fully standalone**. Each owns only
itself and MUST NOT reference a sibling — or the orchestrator — by filesystem path, `require`, or
subprocess. Removing any member never breaks another. Only **`sutra`** is allowed to reach into members
(it drives them as libraries). This invariant is enforced in CI by the *independence gate*.

- Adding cross-member behavior → it belongs in `sutra`, never in a member.
- `sutra` composes members via its registry + the artifact **interchange schema** it owns
  (`skills/sutra/schema/`). Members exchange data through generic primitives (e.g. sb's `ingest.js`
  consumes a payload; it has no idea sutra produced it).

See [ADR 0002](./docs/adr/0002-sutra-orchestrator-and-plugin-independence.md).

## Tech stack

- **Zero-dependency Node.js.** No `package.json`, no `node_modules`, no build step. Everything is plain
  `node:*` built-ins. Target runtime: Node 18+ (CI matrix: 18, 20).
- Logic lives in `bin/*.js` CLIs and `lib/*.js` helpers; commands are Markdown wrappers under
  `commands/`; hooks are `hooks/*.js`. Tests are `node:test` under `tests/`.

## Build / test / lint

There is no build. Run tests directly with the Node test runner:

```bash
node --test skills/code_assist/tests/ca-tools.test.js   # code_assist backbone
node --test skills/sutra/tests/sutra-tools.test.js      # sutra orchestrator + payload↔ingest contract
node --test skills/sb/tests/ingest.test.js              # sb ingest primitive + git repoRoot
node skills/code_assist/tests/structural-eval.js        # code_assist skill-tree consistency (standalone)
node skills/sutra/bin/sutra-tools.js schema-check . --exit-code   # interchange-schema conformance
find skills -name '*.js' -exec node --check {} \;       # syntax sweep
```

The LLM-graded eval harness (`skills/code_assist/tests/eval/run-evals.js`) is **opt-in and
token-costing** — it drives the real `claude` CLI. Do not run it in CI or by default.

CI (`.github/workflows/ci.yml`) runs all of the above plus the independence gate on every push/PR.

## Conventions

- **Conventional Commits** (`feat|fix|refactor|docs|test|chore|ci:`), subject ≤72 chars, no trailing
  period. Atomic commits — one logical change each.
- **No AI attribution footer** (no `Co-Authored-By: Claude`).
- Never commit to `main` — branch first, PR in.
- Run the relevant suite before committing. Keep changes zero-dep.
- Match each plugin's existing idiom (comment density, naming). Members must stay sibling-blind — if a
  test needs to exercise a cross-member seam, it lives in `sutra/tests` (which may drive a member),
  never in a member's own `tests/` (which stay standalone).

## Architecture decisions (ADR index)

Bodies live in [`docs/adr/`](./docs/adr/); this is the index only.

- [0001](./docs/adr/0001-monorepo-layout.md) — Monorepo layout for claude-skills-pack
- [0002](./docs/adr/0002-sutra-orchestrator-and-plugin-independence.md) — Sutra orchestrator + full
  plugin independence

Before a non-trivial architectural change (new member, schema change, registry model, bridge seam),
read the relevant ADR; if the decision isn't recorded, draft a new one as part of the plan.

## Known issues

Open audit-surfaced defects (not yet fixed) live in [`docs/KNOWN_ISSUES.md`](./docs/KNOWN_ISSUES.md).
Check it before touching sutra's review parsers or sb's frontmatter/vault-repair paths.

## Gotchas

- **Versions are per-plugin** (`skills/<plugin>/.claude-plugin/plugin.json`) and also mirrored in
  `.claude-plugin/marketplace.json` — bump both on release.
- `sutra`'s member lookup honors `SUTRA_SKILLS_DIR` (pins the installed-skills root; when set, the
  dev-sibling fallback is skipped so tests can pin an exact member set).
- `sb` vault writes honor `SB_VAULT_PATH` (and `SB_MEMORY_DIR`) — tests point these at temp dirs.
- Runners resolve their `lib/` relative to `__dirname` where it matters for in-repo testing
  (`sb/commands/_runners/ingest.js`); the other sb runners still use a `~/.claude/skills/sb/lib`
  homedir path (installed-only). Harmless drift — don't "fix" it wholesale without cause.
