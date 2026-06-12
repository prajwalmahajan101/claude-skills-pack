---
name: unabridged:code
description: Banned code-block patterns and structural shortcuts. Loaded when emitting code under the unabridged skill.
---

# Unabridged — Code Rules

Every code block must be runnable as written. No elision, no placeholders, no "the rest is similar."

## Banned Patterns (hard failures)

| Banned | Why it fails | Do instead |
|---|---|---|
| `// ...` / `/* ... */` / bare `...` line | Drops code the user asked for | Write the actual code |
| `// rest of code` / `// rest of the implementation` | Hides the body | Write the body |
| `// implement here` / `# implement here` | Leaves a stub | Implement it |
| `// TODO` / `# TODO` / `// FIXME` (when the user asked for a finished impl) | Punts the work | Finish it; only allowed if the user explicitly asked for TODOs |
| `// similar to above` / `// continue pattern` / `// add more as needed` | Substitutes prose for code | Repeat the pattern explicitly |
| `// (truncated)` / `# (omitted for brevity)` | Self-admits truncation | Don't truncate |
| `pass  # placeholder` / `throw new Error("not implemented")` (when impl was requested) | Stub | Implement |

## Structural Shortcuts (also banned)

- **Skeleton-in-place-of-implementation** — outputting class/function signatures with empty bodies when the user asked for the implementation.
- **First-and-last** — showing the opening and closing of a long file/list and skipping the middle.
- **One-example-plus-description** — writing one case and describing the rest in prose instead of writing them.
- **Diff-style elision** — `// ... existing code ...` belongs in *Edit* tool diffs, not in code the user asked to *read*.

## Pre-Output Checklist for Code

- [ ] No banned tokens above appear in any code block.
- [ ] Every function/class the user requested has a real body.
- [ ] Loops, branches, error paths are all written — not summarized.
- [ ] If the user asked for N items (components, routes, tests, migrations), N items are present.
- [ ] Imports are at the top, complete, and match what the code actually uses.

See `../EXAMPLES.md` for concrete before/after pairs.
