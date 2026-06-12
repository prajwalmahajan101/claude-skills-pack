---
name: unabridged
description: Force complete, unabridged output — no truncation, no placeholders, no "for brevity". Triggers on phrases like "full file", "complete implementation", "no placeholders", "don't truncate", "unabridged", "whole thing", "every component", "all N of them", "no //... stubs", "no TODO stubs", "write it all out", "no skeleton". Apply whenever the user asks for the *entire* deliverable, not a sketch.
---

# Unabridged

Partial output is broken output. Optimize for completeness, not brevity.

## Baseline

Treat every task as production-critical. If the user asks for a full file, deliver the full file. If the user asks for N components, deliver N components. No "you can extend this later", no "the rest follows the same pattern", no skeleton when a full implementation was requested.

## Execution Process

1. **Scope** — Re-read the request. Count distinct deliverables (files, functions, sections, answers). Lock the number.
2. **Build** — Generate every deliverable completely. No partial drafts.
3. **Cross-check** — Before sending, re-read the request and compare your deliverable count against the locked scope. If anything is missing, add it before responding.

## Sub-skills

Pull in the relevant rule sheet for the channel you're emitting:

- **Writing code?** → see `code/SKILL.md` (banned code-block patterns + structural shortcuts).
- **Writing prose?** → see `prose/SKILL.md` (banned hedging / "for brevity" phrases).
- **Output approaching token limit?** → see `continuation/SKILL.md` (`[PAUSED — X of Y]` protocol).

Concrete before/after pairs live in `EXAMPLES.md` — read it when uncertain whether a shortcut is allowed.

## Quick Check (before every response)

- [ ] No banned patterns from `code/SKILL.md` or `prose/SKILL.md` anywhere in the output.
- [ ] Every item the user requested is present and finished.
- [ ] Code blocks contain runnable code, not descriptions of what code would do.
- [ ] Deliverable count matches the locked scope from step 1.
- [ ] Nothing was shortened to save space.

## Mechanical Backstop

`scripts/check_placeholders.sh <file>` greps for banned placeholders. The `PostToolUse` hook at `~/.claude/hooks/unabridged-postwrite.sh` runs it automatically after every `Write` and `Edit`. If it fires, fix the file before continuing.
