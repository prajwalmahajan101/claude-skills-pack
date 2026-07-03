---
name: code_assist
description: "Self-contained developer-workflow powerhouse. Use whenever the user wants to: commit (atomic, conventional commits), review code (backend/frontend/tui/fullstack architectural review), write a phase journal, PLAN work (brainstorm/write/execute a design), DEBUG (scientific-method root-cause), record an ADR (architecture decision), VERIFY a change works, or run a cross-family FLOW (ship/start/fix). Triggers on: 'commit', 'git commit', 'atomic commits', 'split commits', 'review code', 'code review', 'check code quality', 'review backend/frontend/tui', 'journal', 'phase journal', 'log this phase', 'plan this', 'brainstorm', 'design approach', 'break this down', 'debug', 'why is this failing', 'root cause', 'ADR', 'architecture decision', 'record why we chose', 'verify', 'confirm it works', 'is this done', 'ship this', 'take this from ticket to PR'. Always use this skill instead of raw git commits, ad-hoc reviews, hand-rolled journals/plans/ADRs, or guess-and-check debugging."
---

# code_assist — Developer Workflow Powerhouse

A self-contained hub of disciplined developer-workflow families. Routes the request to the
right family, backed by a deterministic Node CLI and a baked-in discipline layer.

## Read first (every invocation)
1. `_shared/discipline.md` — Iron Laws, Red-Flags, checklists-as-todos, family-chaining.
2. `_shared/conventions.md` — commit/branch/versioning rules (incl. **no AI footer**).
3. `_shared/state.md` + `node bin/ca-tools.js state-read` — the repo's `.code_assist/STATE.md`.

Preconditions: if not in a git repository, say so and stop (except `plan brainstorm`).

## Top-Level Routing

| Request | Router | Slash command |
|---|---|---|
| Commit / atomic commits / split / dry-run plan | `git-commit/ROUTER.md` | `/code_assist:git_commit` |
| Code review (backend/frontend/tui/fullstack) | `code-review/ROUTER.md` | `/code_assist:code_review` |
| Phase journal (new/update) | `journal/ROUTER.md` | `/code_assist:journal` |
| Plan work — brainstorm/write/execute (HARD-GATE) | `plan/ROUTER.md` | `/code_assist:plan` |
| Debug — scientific-method root cause | `debug/ROUTER.md` | `/code_assist:debug` |
| ADR — record/supersede/index a decision | `adr/ROUTER.md` | `/code_assist:adr` |
| Verify — fresh evidence before "done" | `verify/ROUTER.md` | `/code_assist:verify` |
| Flow — cross-family chain (ship/start/fix/land) | `orchestrator/ROUTER.md` | `/code_assist:flow` |
| Structure — audit/scaffold/fix project layout | `structure/ROUTER.md` | `/code_assist:structure` |
| Format — markdown (zero-dep) / code | `format/ROUTER.md` | `/code_assist:format` |
| GitHub — PR/CI/issue via `gh` | `github/ROUTER.md` | `/code_assist:github` |
| Track — Jira issue fetch/comment/transition | `track/ROUTER.md` | `/code_assist:track` |
| Notify — Slack / Telegram | `notify/ROUTER.md` | `/code_assist:notify` |
| Scan — SonarQube / Semgrep (review pre-pass) | `scan/ROUTER.md` | `/code_assist:scan` |
| Graph — code intelligence (gitnexus/graphify) | `graph/ROUTER.md` | `/code_assist:graph` |

*(Growing: `onboard`, `refactor`, `test`, `release`, and condensed domain playbooks land in
Wave 3. Integration writes stay dry-run + confirm; reads need the relevant env token.)*

## How to use
1. Identify the family from the table (commit / review / journal / plan / debug / adr /
   verify / flow). For multi-step asks, use `flow`.
2. Read that family's `ROUTER.md`; it selects the variant and names the files to load.
3. Create one todo per checklist item; follow the family exactly (rigid families) or adapt
   the principle (flexible families) per `_shared/discipline.md`.

## Deterministic backbone — `bin/ca-tools.js`
Zero-dependency Node CLI for all exact logic (the LLM judges, the CLI computes):
`stack-detect`, `diff-stats`, `structure-audit`/`structure-scaffold`, `state-read`/`state-write`,
`md-format`, `graph` (gitnexus + graphify code intelligence — `impact` = blast radius),
`github`/`track`/`notify`/`scan` (integrations; reads via env tokens, writes dry-run + confirm).
Run `node ~/.claude/skills/code_assist/bin/ca-tools.js <cmd>` — output is JSON.

## Combined requests
- "review then commit" → `review` → fix loop → `commit`.
- "commit then journal" → `commit` → `journal` (references new SHAs).
- "ticket to PR" / "ship it" → `/code_assist:flow ship` (or `start`).

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
├── verify/ROUTER.md
├── agents/*.md              # subagents
└── commands/*.md            # thin multi-level slash commands
```
