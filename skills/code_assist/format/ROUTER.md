---
name: code_assist/format/ROUTER
description: Formatting family - normalize markdown (zero-dep, ASCII-safe, code-block-aware) and run the project's code formatter. Used to keep docs and code consistently formatted.
type: router
---

# Format Router

| Action | How | Command |
|---|---|---|
| Format markdown | `node bin/ca-tools.js md-format <file...> [--write]` | `/code_assist:format` |
| Format code | run the project's formatter (below) | `/code_assist:format` |

## Markdown (`md` - self-contained, zero-dep)
`ca-tools md-format` trims trailing whitespace, converts tabs to spaces, ASCII-normalizes
smart quotes / en-em dashes / ellipsis / nbsp, collapses 3+ blank lines, ensures a single
trailing newline - and **never touches fenced code blocks**. Dry-run (report `changed`)
unless `--write`. `deno fmt` may be used opportunistically for Markdown if present.

## Code (`code`)
Use the project's configured formatter, in priority order:
- JS/TS: `prettier` (or `deno fmt`, or `biome`) per repo config.
- Python: `ruff format` (or `black`).
- Go: `gofmt`/`goimports`. Rust: `cargo fmt`.
Detect from `stack-detect` + config files. Never impose a formatter the repo hasn't adopted;
if none is configured, suggest adding one (a `style` commit) rather than reformatting silently.

## Rules
- Dry-run and show the diff scope before `--write` on many files.
- Formatting-only changes are their own `style:` commit, never mixed with logic.
