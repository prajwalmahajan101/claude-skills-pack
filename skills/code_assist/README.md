# code_assist

A self-contained developer-workflow **powerhouse** for [Claude Code](https://claude.com/claude-code).
One top-level router, many differentiated multi-level families, a zero-dependency Node
backbone, and a baked-in discipline layer - installed by symlink (this repo is the source of
truth).

## What it does

| Family | Goal | Command(s) |
|---|---|---|
| **git-commit** | Atomic, Conventional-Commits (no AI footer). Plan or interactive. | `/code_assist:git_commit`, `_plan` |
| **code-review** | Stack-aware architectural review (backend/frontend/tui/fullstack) + optional scan/graph pre-pass. | `/code_assist:code_review`, `_backend/_frontend/_tui` |
| **journal** | Phase-journal entries from the project TEMPLATE. | `/code_assist:journal` |
| **plan** | Brainstorm -> write -> execute. The HARD-GATE before design-dependent code. | `/code_assist:plan`, `_write`, `_execute` |
| **debug** | Scientific-method root-cause; no fix without a reproduced cause. | `/code_assist:debug`, `_resume` |
| **adr** | Architecture decision records (Context/Decision/Consequences/Usage) in `docs/adr/`. | `/code_assist:adr`, `_supersede`, `_index` |
| **verify** | Verification-before-completion - fresh evidence, run this turn. | `/code_assist:verify` |
| **structure** | Audit/scaffold/fix a repo against the canonical project structure. | `/code_assist:structure`, `_scaffold`, `_fix` |
| **format** | Zero-dep markdown formatter + project code formatter. | `/code_assist:format` |
| **github / track / notify / scan** | gh PRs/CI, Jira, Slack/Telegram, SonarQube/Semgrep. Reads via env tokens; writes dry-run + confirm. | `/code_assist:github` `:track` `:notify` `:scan` |
| **graph** | Code intelligence - gitnexus (context/impact/detect-changes) + graphify knowledge graph. | `/code_assist:graph` |
| **onboard / test / refactor / release** | Seed CLAUDE.md+architecture; TDD; safe refactor; cut a release. | `/code_assist:onboard` `:test` `:refactor` `:release` |
| **domains** | Condensed backend/frontend/data/animation-3d/tui playbooks (self-contained). | `/code_assist:domains` |
| **flow** | Cross-family orchestrator: `ship`, `start`, `fix`, `land`. | `/code_assist:flow` |

## Architecture

```
code_assist/
├── SKILL.md                     # top-level router
├── bin/ca-tools.js              # zero-dep deterministic backbone (all exact logic)
├── _shared/{discipline,conventions,state}.md   # Iron Laws, commit rules, per-repo state
├── orchestrator/ROUTER.md       # cross-family flows
├── <family>/ROUTER.md + variants + templates
├── domains/                     # condensed self-contained domain playbooks
├── agents/                      # subagents
└── commands/                    # thin multi-level slash commands
```

- **Deterministic backbone** (`bin/ca-tools.js`, Node >= 18, no deps): `stack-detect`,
  `diff-stats`, `structure-audit`/`structure-scaffold`, `state-read`/`state-write`,
  `md-format`, `graph`, and integration helpers (`github`/`track`/`notify`/`scan`). The LLM
  judges; the CLI computes. Output is JSON.
- **Discipline layer** (`_shared/discipline.md`): Iron Laws (root-cause-first, test-first,
  verify-first, plan-gate, no-silent-skip), a Red-Flags table, checklists-as-todos, and
  required family-chaining - inherited from superpowers, self-contained (no plugin dependency).
- **Per-repo state** (`.code_assist/STATE.md` + `config.json`): a small living digest read
  first by every family, plus a structure/integration profile the families auto-follow.
- **Canonical project structure**: derived from auditing the project portfolio; templates in
  `structure/templates/`. `structure audit/scaffold/fix` bring any repo into line and preserve
  house-style markers (`.remember/ .planning/ .journal/ .githooks/ docs/adr/`).

## Install

```bash
./install.sh          # symlinks skill + agents + commands into ~/.claude (idempotent)
```

Override target via `CLAUDE_DIR=/custom/path ./install.sh`. Uninstall: `./uninstall.sh`.

## Integrations (optional, env-gated)

All degrade gracefully (no-op + setup hint) when unconfigured; external writes require
`--confirm`:

| Integration | Env | Notes |
|---|---|---|
| GitHub | `gh` CLI (authed) | no MCP |
| Jira | `JIRA_BASE_URL` `JIRA_EMAIL` `JIRA_TOKEN` | REST; writes confirm-gated |
| Slack / Telegram | `SLACK_WEBHOOK_URL` / `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID` | confirm-gated |
| SonarQube | `SONAR_HOST_URL` `SONAR_TOKEN` (`SONAR_PROJECT_KEY`) | read-only |
| Code intel | `gitnexus`, `graphify` CLIs | optional; blast-radius into review |

## License

MIT - see [LICENSE](../../LICENSE).
