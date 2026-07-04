---
name: sutra/bridge/ROUTER
description: The cross-plugin bridges sutra owns — artifact→vault sync, recall-fusion, and output discipline. All handoffs are registry-gated and no-op when their member is absent. Members never reference each other; every seam lives here.
type: router
---

# Bridge Router

Sutra is the only place the pack's members cooperate. Members stay standalone; sutra reads the
**registry** to see who is present and runs the handoffs that apply. Every handoff below is a no-op
when its member is missing — never a hard dependency, never a reason to stop.

Detect first:

```
node ~/.claude/skills/sutra/bin/sutra-tools.js bridge status
```

This reports `present` (member ids) and per-handoff availability.

## Handoff 0 — reverse channel: recall (reason WITH prior knowledge)

Before designing, reviewing, debugging, or verifying, pull accumulated knowledge so the pack reasons
*with* what it already learned:

```
node bin/sutra-tools.js recall --context "<the task / symptom / area>" --limit 5
```

`recall` **composes members** — it drives code_assist's own recall (harness stores: global lessons,
project `MEMORY.md`, `~/.remember`) and layers sb's verbatim vault highlights. Each item carries a
`ref` (file:line) — **cite it; never paraphrase a lesson into a claim it doesn't make.** With neither
member present, recall returns empty (never fabricates).

| Consumer command | Context it recalls | How it uses it |
|---|---|---|
| `/sutra:plan` | the initiative | fold lessons into options; seed Risks from risk refs |
| `/sutra:review` | the changed area | re-flag known risks / prior regressions |
| `/sutra:debug` | the symptom | past root-cause / risk as a *lead to test* |
| `/sutra:verify` | the goal | reuse what evidence mattered before |
| SessionStart hook | repo + branch | surface up to 2 repo-scoped risks at orientation |

## Handoff 1 — forward channel: artifacts → vault (sync-artifacts)

code_assist writes durable artifacts in the repo; sutra parses them and hands sb a vault-ingest payload:

```
node bin/sutra-tools.js sync-artifacts <repo> [--project <slug>]
```

| Artifact | Path | Becomes |
|---|---|---|
| journal | `.journal/M<phase>.md` | a `journal` note in the project's vault folder |
| code review | `.code_review/**/*.md` | `code-review` notes + open-issue surfacing in the project INDEX |
| ADR | `docs/adr/NNNN-*.md` | a `decision` note |

The payload is built from the **interchange schema** sutra owns (`schema/*.spec.md`); run
`schema-check <repo>` to confirm the producer's output still conforms. When sb is present, feed the
payload's `notes` to sb's generic ingest primitive. When sb is absent, the artifacts still live in-repo
(git-tracked) — nothing is lost.

## Handoff 2 — output discipline (unabridged)

Steps that must emit a *whole* deliverable (`plan execute`, `onboard`'s CLAUDE.md, `structure scaffold`,
any "write the entire file" step) honor the `unabridged` no-truncation rule when it is present. When
absent, the member's own placeholder guarantees still hold.

## Handoff 3 — the closed loop (loop-emit → capture → recall)

`verify` / `plan` completions and `incident` postmortems emit feedback events:

```
node bin/sutra-tools.js loop-emit --event verify --note "<outcome>" [--risk]
```

The command layer offers to promote the event to an sb lesson (`/sutra:capture`), some tagged `risk` —
which is exactly what `recall` (Handoff 0) surfaces next time. **Writing out feeds the pull-back.**

## Rule

Bridges are additive. If a member is missing, say nothing about it and proceed. Never re-implement a
member's logic — drive its router/runner and wire the seam.
