---
name: code_assist/bridge/ROUTER
description: Documents how code_assist hands off to its sibling skills (sb second-brain, unabridged complete-output) when they are installed. All handoffs are optional - code_assist is fully self-contained without them.
type: router
---

# Bridge Router

code_assist is self-contained. When its sibling skills from the same pack are installed, three
handoffs make the whole `claude-skills-pack` cooperate. Detect what is present first:

```
node ~/.claude/skills/code_assist/bin/ca-tools.js bridge status
```

This reports `siblings.{sb,unabridged}` (bool) and a one-line handoff description for each. Every
handoff below is a no-op when its sibling is absent - never a hard dependency.

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

The `SessionStart` hook surfaces `.code_assist/STATE.md` "Now" + the structure score; the
`PreToolUse` git-guard enforces `_shared/conventions.md`. These are code_assist-internal (no
sibling needed) but compose cleanly with sb's own session hooks - both are gated by their own
`*_DISABLE` env var so neither blocks the other.

## Rule

Bridges are additive. If a sibling is missing, say nothing about it and proceed - a bridge is
never a reason to stop or to require an install.
