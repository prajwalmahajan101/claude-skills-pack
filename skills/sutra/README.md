# sutra

The orchestrator for [`claude-skills-pack`](../../README.md) — "holder of the threads."

Sutra is the composition root that makes the pack's members cooperate:

- **code_assist** — developer workflow (commit, review, journal, plan, debug, verify, adr, …)
- **sb** — second-brain vault capture (lessons, tasks, kanban, …)
- **unabridged** — no-truncation output discipline

Each member is **fully standalone** — installed on its own it does only its own job and never
references the others. Install **sutra** and the pack becomes one cooperating system behind a single
canonical command surface: `/sutra:*`.

## Two ways to use the pack

1. **À la carte** — install any member(s) you want and use their own namespaces (`/code_assist:*`,
   `/sb:*`). No cross-plugin behavior; maximum isolation.
2. **Full pack** — also install sutra. Now `/sutra:commit` commits *and* journals *and* offers to
   capture a lesson; `/sutra:review` recalls prior risks first; `/sutra:verify` feeds the memory loop.

Removing sutra never breaks a member.

## What sutra owns

| Concern | Where |
|---|---|
| **Capability registry** — which members exist + what they do | `registry/members.json` + `sutra-tools.js registry` |
| **Interchange schema** — canonical `.journal` / `docs/adr` / `.code_review` shapes | `schema/*.spec.md` + `sutra-tools.js schema-check` |
| **Bridges** — artifact→vault sync, recall-fusion | `bridge/ROUTER.md` |
| **Feedback loop** — verify/plan/incident → lesson → recall | `loop/ROUTER.md` |
| **Unified command surface** — `/sutra:*` | `commands/` + `commands/_manifest.json` |

The registry **inverts the dependency**: members never detect each other; sutra is the single place
member presence and capabilities are declared. A missing member makes its bridge a silent no-op.

## CLI

`bin/sutra-tools.js` (zero-dep, JSON out):

```
sutra-tools registry              resolve members + versions + capabilities
sutra-tools selfcheck             registry + orchestrator config
sutra-tools bridge status         per-handoff availability
sutra-tools recall --context "…"  fused recall (member base + sb vault)
sutra-tools sync-artifacts <repo> parse .journal/.code_review/ADRs → vault payload
sutra-tools schema-check <repo>   conformance of member output vs the schema specs
sutra-tools loop-emit --event …   record a feedback event
sutra-tools version
```

## Install

```bash
./install.sh          # symlinks the skill + commands, merges the SessionStart hook
./uninstall.sh        # removes them; members stay standalone
```

Disable the session hook with `SUTRA_DISABLE=1`.

## Develop

```bash
make lint             # syntax-check all JS
make test             # zero-dep unit tests (node:test)
```
