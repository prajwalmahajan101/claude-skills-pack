---
name: code_assist
description: "Self-contained developer-workflow powerhouse. Use whenever the user wants to: commit (atomic, conventional commits), review code (backend/frontend/tui/fullstack architectural review), write a phase journal, PLAN work (brainstorm/write/execute a design), DEBUG (scientific-method root-cause), record an ADR (architecture decision), VERIFY a change works, or run a cross-family FLOW (ship/start/fix). Triggers on: 'commit', 'git commit', 'atomic commits', 'split commits', 'review code', 'code review', 'check code quality', 'review backend/frontend/tui', 'journal', 'phase journal', 'log this phase', 'plan this', 'brainstorm', 'design approach', 'break this down', 'debug', 'why is this failing', 'root cause', 'ADR', 'architecture decision', 'record why we chose', 'verify', 'confirm it works', 'is this done', 'ship this', 'take this from ticket to PR'. Always use this skill instead of raw git commits, ad-hoc reviews, hand-rolled journals/plans/ADRs, or guess-and-check debugging."
---

# code_assist - Developer Workflow Powerhouse

A self-contained hub of disciplined developer-workflow families. Routes the request to the
right family, backed by a deterministic Node CLI and a baked-in discipline layer.

## Read first (every invocation)
1. `_shared/discipline.md` - Iron Laws, Red-Flags, checklists-as-todos, family-chaining.
2. `_shared/conventions.md` - commit/branch/versioning rules (incl. **no AI footer**).
3. `_shared/state.md` + `node bin/ca-tools.js state-read` - the repo's `.code_assist/STATE.md`.

Preconditions: if not in a git repository, say so and stop (except `plan brainstorm`).

## Top-Level Routing

| Request | Router | Slash command |
|---|---|---|
| Commit / atomic commits / split / dry-run plan | `git-commit/ROUTER.md` | `/code_assist:git_commit` |
| Code review (backend/frontend/tui/fullstack) | `code-review/ROUTER.md` | `/code_assist:code_review` |
| Phase journal (new/update) | `journal/ROUTER.md` | `/code_assist:journal` |
| Plan work - brainstorm/write/execute (HARD-GATE) | `plan/ROUTER.md` | `/code_assist:plan` |
| Debug - scientific-method root cause | `debug/ROUTER.md` | `/code_assist:debug` |
| ADR - record/supersede/index a decision | `adr/ROUTER.md` | `/code_assist:adr` |
| Verify - fresh evidence before "done" | `verify/ROUTER.md` | `/code_assist:verify` |
| Flow - cross-family chain (ship/start/fix/land) | `orchestrator/ROUTER.md` | `/code_assist:flow` |
| Structure - audit/scaffold/fix project layout | `structure/ROUTER.md` | `/code_assist:structure` |
| Format - markdown (zero-dep) / code | `format/ROUTER.md` | `/code_assist:format` |
| GitHub - PR/CI/issue via `gh` | `github/ROUTER.md` | `/code_assist:github` |
| Track - Jira issue fetch/comment/transition | `track/ROUTER.md` | `/code_assist:track` |
| Notify - Slack / Telegram | `notify/ROUTER.md` | `/code_assist:notify` |
| Scan - SonarQube / Semgrep (review pre-pass) | `scan/ROUTER.md` | `/code_assist:scan` |
| Graph - code intelligence (gitnexus/graphify) | `graph/ROUTER.md` | `/code_assist:graph` |
| Onboard - architecture map + seed CLAUDE.md | `onboard/ROUTER.md` | `/code_assist:onboard` |
| Test - TDD (failing test first) | `test/ROUTER.md` | `/code_assist:test` |
| Refactor - restructure under a green suite | `refactor/ROUTER.md` | `/code_assist:refactor` |
| Release - changelog + version + tag | `release/ROUTER.md` | `/code_assist:release` |
| Domains - backend/frontend/data/3d/tui playbooks | `domains/ROUTER.md` | `/code_assist:domains` |

*(Integration writes stay dry-run + confirm; reads need the relevant env token. Domain
playbooks are condensed + self-contained; they name deeper standalone skills as optional.)*

## How to use
1. Identify the family from the table (commit / review / journal / plan / debug / adr /
   verify / flow). For multi-step asks, use `flow`.
2. Read that family's `ROUTER.md`; it selects the variant and names the files to load.
3. Create one todo per checklist item; follow the family exactly (rigid families) or adapt
   the principle (flexible families) per `_shared/discipline.md`.

## Deterministic backbone - `bin/ca-tools.js`
Zero-dependency Node CLI for all exact logic (the LLM judges, the CLI computes):
`stack-detect`, `diff-stats`, `structure-audit`/`structure-scaffold`, `state-read`/`state-write`,
`md-format`, `graph` (gitnexus + graphify code intelligence - `impact` = blast radius),
`github`/`track`/`notify`/`scan` (integrations; reads via env tokens, writes dry-run + confirm).
Run `node ~/.claude/skills/code_assist/bin/ca-tools.js <cmd>` - output is JSON.

## Combined requests
- "review then commit" → `review` → fix loop → `commit`.
- "commit then journal" → `commit` → `journal` (references new SHAs).
- "ticket to PR" / "ship it" → `/code_assist:flow ship` (or `start`).

## Agents (context-budgeted subagents)
Delegate heavy work to a subagent (each ROUTER has an "Execution Mode - Agent Dispatch" section;
inline stays the default for small repos):
- `ca-planner` - brainstorm → write a plan to `.code_assist/.plan/`.
- `ca-debugger` - scientific-method DEBUG.md session (no fix without a reproduced root cause).
- `ca-verifier` - goal-backward, evidence-based verification.
- `ca-structure-auditor` - structure audit + scaffold plan.
- plus `architectural-reviewer`, `commit-planner`, `journal-writer` (family workers).

## Hooks (deterministic guardrails)
Registered into `settings.json` by `install.sh` (both gated by `CA_DISABLE=1`):
- `ca-session-start` (SessionStart) - prints `.code_assist/STATE.md` "Now" + structure score;
  silent outside a git repo.
- `ca-git-guard` (PreToolUse:Bash) - WARNs on `git commit` to main/master, blanket `git add .`/`-A`,
  or `--no-verify`; hard-blocks only under `CA_GIT_GUARD_STRICT=1`.

## Tests (self-verifying, not just prompt-ware)
- `make test` - `node --test` unit tests over `ca-tools.js` (stack-detect, structure audit/scaffold,
  diff classify, md-format, dry-run gating, changelog/version-detect).
- `make eval` - zero-cost structural eval (commands→family resolve, discipline loaded, no placeholder
  leakage, manifests valid). CI-ready, exits non-zero on any failure.
- `make eval-llm` - opt-in, token-costing behavioral evals (`claude -p` + `tests/eval/grader.md`):
  asserts each family resists bait (debug won't guess-fix, commit emits no AI footer, plan won't code
  before approval).

## Bridge (optional, **bidirectional**) - `bridge/ROUTER.md`
The pack cooperates **both ways** (all optional; `ca-tools bridge status` shows siblings + `pull`):
- **Pull-back (memory → responses):** `ca-tools recall --context "<task>"` surfaces relevant prior
  **lessons / memory / risks** (with file:line provenance) so `plan`/`debug`/`code_review`/`verify`
  and the session-start hook reason *with* accumulated knowledge. Self-contained (reads
  `~/.claude/lessons`, harness `MEMORY.md`, `~/.remember` directly); fuses sb's vault when present.
  Manual pull: `/code_assist:recall`.
- **Write-out (artifacts → vault):** journal/adr/review/verify artifacts hand off to **sb**
  (`/sb:sync-project`, `/sb:lesson`) - which then feeds the pull-back next time (closed loop).
- **Complete output:** full-output families (`plan execute`, `onboard`, `structure scaffold`) honor
  **unabridged** when installed.

## Plugin usage
This skill is also a plugin in the repo-root `claude-skills-pack` marketplace:
`claude plugin marketplace add <repo>` then `/plugin install code_assist@claude-skills-pack`
(or run `install.sh` for the symlink install). `hooks/hooks.json` uses `${CLAUDE_PLUGIN_ROOT}`.

## Sub-skill tree
```
code_assist/
├── SKILL.md                 # this router
├── bin/ca-tools.js          # deterministic backbone
├── _shared/{discipline,conventions,state}.md
├── orchestrator/ROUTER.md   # cross-family flows
├── git-commit/  code-review/  journal/          # original families
├── plan/{ROUTER,shared,brainstorm,write,execute}.md
├── debug/{ROUTER,shared,investigate,resume}.md
├── adr/{ROUTER,shared,new,supersede,index}.md
├── verify/ROUTER.md  structure/  release/  onboard/  refactor/  test/
├── github/  track/  notify/  scan/  graph/  format/  domains/
├── agents/*.md              # subagents (ca-planner/debugger/verifier/structure-auditor + workers)
├── hooks/{hooks.json,ca-session-start.js,ca-git-guard.js}
├── bridge/ROUTER.md         # optional sb/unabridged handoffs
├── tests/{ca-tools.test.js,structural-eval.js,eval/*}
├── .claude-plugin/plugin.json
└── commands/*.md            # thin multi-level slash commands
```
