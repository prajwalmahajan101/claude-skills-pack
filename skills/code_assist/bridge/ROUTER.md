---
name: code_assist/bridge/ROUTER
description: Documents the BIDIRECTIONAL bridge between code_assist and its siblings - it writes artifacts OUT to sb and pulls lessons/memory/risks BACK to inform responses, and defers to unabridged for complete output. All handoffs are optional; code_assist is fully self-contained without them.
type: router
---

# Bridge Router

code_assist is self-contained. When its sibling skills from the same pack are installed, the whole
`claude-skills-pack` cooperates - and the flow runs **both ways**. Detect what is present first:

```
node ~/.claude/skills/code_assist/bin/ca-tools.js bridge status
```

This reports `siblings.{sb,unabridged}` (bool), each write-out handoff, and the `pull` (reverse)
channel with its source counts. Every handoff below is a no-op when its sibling/store is absent -
never a hard dependency.

## Handoff 0 - sb / memory → code_assist (pull-back: reason WITH prior knowledge)

**This is the reverse channel.** Before designing, debugging, reviewing, or verifying, families
pull relevant accumulated knowledge so the pack reasons *with* what it already learned:

```
node bin/ca-tools.js recall --context "<the task / symptom / area>" --limit 5
```

`recall` reads three stores **directly** (self-contained - works with sb absent): global lessons
(`~/.claude/lessons/`), the project's harness `MEMORY.md`, and `~/.remember/recent.md`. When sb is
installed it also fuses sb's verbatim vault highlights. Every returned item carries a `ref`
(file:line) - **cite it; never paraphrase a lesson into a claim it doesn't make.**

| Consumer | Context it recalls | How it uses it |
|---|---|---|
| `plan` (brainstorm/write) | the initiative | fold lessons into options; seed Risks from risk `ref`s |
| `debug` | the symptom | past root-cause / risk as a *lead to test* (Iron Law still holds) |
| `code_review` | the changed area | re-flag known risks / prior regressions |
| `verify` | the goal | reuse what evidence mattered before |
| `SessionStart` hook | repo name + branch | surface up to 2 repo-scoped **risks** at orientation |

**The closed loop:** `verify`/`plan` completion and `incident` postmortems emit sb lessons (some
tagged `risk`) → those are exactly what `recall` surfaces next time. Writing out *feeds* the
pull-back. `bridge status` reports `pull.available` + per-store counts so the channel is observable.

## Handoff 1 - code_assist → sb (artifacts into the vault)

code_assist writes durable engineering artifacts to the repo:

| Family | Artifact | sb ingestion |
|---|---|---|
| `journal` | `.journal/M<phase>.md` | `sync-project.js` mirrors into the vault's project note |
| `adr` | `docs/adr/NNNN-*.md` | ingested as project decisions |
| `code_review` | `.code_review/*` state files | ingested as review history |
| `verify` / `plan` (on completion) | a proven outcome / decision | can be emitted as an sb lesson |

**When sb is present:** after writing any of the above, call `/sb:sync-project` so the artifact
lands in the vault. On a proven `verify` result or a resolved `plan`, offer `/sb:lesson "<title>"`
to capture the durable takeaway. sb's own capture hooks may already ingest on session end - the
explicit sync just makes the handoff immediate and observable.

**When sb is absent:** the artifacts still live in-repo (git-tracked); nothing is lost.

## Handoff 2 - code_assist → unabridged (no-truncation on full-output families)

Families that must emit a *whole* deliverable defer to the `unabridged` rule when it is installed:

- `plan execute` - write the full plan / full implementation, no `// ...` stubs.
- `onboard` - the generated `CLAUDE.md` is complete, not a skeleton.
- `structure scaffold` - scaffolded files are real, not placeholders.
- any "write the entire file" step in any family.

**When unabridged is present:** follow its no-truncation discipline for those steps (the pack's
`unabridged` SKILL.md governs). **When absent:** code_assist still forbids placeholder leakage via
its own `structural-eval` placeholder check - the guarantee holds, just without the extra skill.

## Handoff 3 - hooks & state (already deterministic)

The `SessionStart` hook surfaces `.code_assist/STATE.md` "Now" + the structure score + up to 2
repo-scoped risks (via `recall`); the `PreToolUse` git-guard enforces `_shared/conventions.md`.
These are code_assist-internal (no sibling needed) but compose cleanly with sb's own session hooks
- both are gated by their own `*_DISABLE` env var so neither blocks the other.

## Rule

Bridges are additive. If a sibling is missing, say nothing about it and proceed - a bridge is
never a reason to stop or to require an install.
