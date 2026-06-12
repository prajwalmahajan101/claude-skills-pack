---
name: code_assist/code-review/shared
description: Shared steps and output schema for backend/frontend/tui code reviews — state loading, exploration, output, living-doc rewrite, issue resolution
type: shared
---

# Code-Review — Shared Workflow

Used by all variants (`backend.md`, `frontend.md`, `tui.md`). The variant file supplies the **weight table** and **anti-pattern checklist**; this file supplies everything else.

**Focus on:** architecture, engineering quality, structure, safety, maintainability, and scalability.

**Do NOT evaluate:** authentication, test coverage metrics, monitoring / alerting. (Architectural observations *about* testability or observability readiness are still valid — just do not score test coverage or alert configuration.)

---

## Paths

All state lives in `.code_review/`. When the router selected a **single** stack, files sit flat:

```
.code_review/code_review_issues.md
.code_review/code_review_history.md
.code_review/learning.md
.code_review/architecture_map.md
```

When the router is running a **fullstack** review, each stack writes to its own subfolder (e.g. `.code_review/backend/...`, `.code_review/frontend/...`) plus a top-level `SUMMARY.md`. Use `<STATE_DIR>` below to mean whichever path applies.

All scoring uses a **1–10 scale** (1 = critical problems, 10 = excellent). Overall = weighted average.

---

## Targeted Review Path (no weighting)

If the router routed to this file with `targeted=true` (user said "review my changes", "review last commit", "review this PR", etc.), use this format and stop:

```
## Targeted Review: <brief description of changes>

### Findings
**[Severity]** — file:line — issue and suggested fix.
**[Severity]** — file:line — issue and suggested fix.

### Summary
N issues (N critical, N high, N medium, N low). <one-line overall assessment>
```

Use `git diff` / `git show` / `git diff --cached` as appropriate. Skip Steps 1, 2, 4–6 below.

---

## Step 1: Load Previous Review State

Check for these files under `<STATE_DIR>` and read them fully before starting:

- `<STATE_DIR>/code_review_issues.md`
- `<STATE_DIR>/code_review_history.md`   *(living document)*
- `<STATE_DIR>/learning.md`              *(living document)*
- `<STATE_DIR>/architecture_map.md`

If they exist:
- Use `learning.md` to guide this review.
- Use `code_review_history.md` to compute deltas and detect regressions.
- Use `code_review_issues.md` to carry unresolved issues forward with existing IDs.
- Use `architecture_map.md` as the starting mental model; validate it against the current code.

If they do not exist, create the directory and treat this as the first review (no deltas, no carried-forward issues).

**Do not** treat these as append-only logs. `code_review_history.md` and `learning.md` are **living documents** — see Step 5.

---

## Step 2: Explore the Codebase

### Step 2.0: Use the code-intelligence layer first (if present)

Before falling back to raw Glob/Grep, check for a prebuilt code graph — it gives a faster, more complete structural model and is far cheaper on context for large repos:

- **Graphify graph** — if `graphify-out/graph.json` exists, read it to seed the architecture model. Read `graphify-out/GRAPH_REPORT.md` if present — its "god nodes" / hotspots are direct **anti-pattern candidates** for Step 3.
- **GitNexus** — if the `gitnexus` CLI is available (`command -v gitnexus`, else `npx gitnexus@latest`) and the repo is indexed, use `gitnexus query "<area>"` and `gitnexus context <symbol>` to map modules, callers, and dependencies precisely.

Use these via **Bash/Read only** — the MCP servers and the `code-intel` agent are *not* reachable from inside this review (a subagent can't call MCP or spawn agents). Do **not** run a long `gitnexus analyze` index yourself; if the repo isn't indexed, just note it and fall back to Glob/Grep.

### Step 2.1: Fill gaps with Glob/Grep

Use `Glob` and `Grep` to understand whatever the graph doesn't cover:
- Entry points, modules, packages
- Configuration files
- Data models and schemas
- API routes / UI components / TUI views (whichever applies)
- Shared utilities and helpers
- Build and deployment config

Build a mental model of the whole system before scoring anything. Validate any graph-derived claim against the real code before relying on it.

For large repos (>100 files), the graph (Step 2.0) is the primary tool; otherwise focus on core modules, entry points, and shared libraries. Use `git ls-files | wc -l`, directory-level globs, and `--stat` diffs to stay within context.

---

## Step 3: Perform the Review

Explicitly detect:
- Architectural anti-patterns (use the variant file's checklist)
- Tight coupling and layering violations
- Naming quality problems
- Ownerless or inconsistent modules
- Future scalability or failure risks
- Design **regressions** vs. the previous review (if prior state exists)

**Ground severity in measured blast radius (if GitNexus is available).** For each suspected coupling hotspot or risky symbol, run `gitnexus impact <symbol>` (via Bash; upstream/dependants is the default, returns `impactedCount` + `risk`). A defect or anti-pattern in a high-fan-in symbol (large `impactedCount`, or a `GRAPH_REPORT.md` god-node) is higher Severity/Priority — and now you can say so *with evidence* ("impactedCount 65, risk MEDIUM per `gitnexus impact`"). Use this to justify P0/Critical vs. P2/P3 in Step 4's issues, not gut feel. If GitNexus isn't available, assign severity as before and note that blast radius was not measured.

Every observation must be grounded in real code (`file:line`). No hypothetical or generic advice.

---

## Step 4: Output the Review

**Issue IDs** are globally auto-incrementing per `<STATE_DIR>`. Read the highest existing ID from `code_review_issues.md` and increment. If none exist, start at `ISSUE-001`.

Use this exact format:

```markdown
## Stack
<backend | frontend | tui>

## Maturity Level

**Level XX — Label**

| Level | Label | Description |
|---|---|---|
| 10 | Prototype | Proof of concept, no production concerns addressed |
| 20 | Early Foundation | Basic structure in place, minimal error handling |
| 30 | Early Production | Functional but fragile, limited observability |
| 40 | Stabilizing | Core patterns established, gaps in edge cases |
| 50 | Growing System | Solid fundamentals, scaling concerns emerging |
| 60 | Maturing | Well-structured, most best practices followed |
| 70 | Production Ready | Reliable, observable, handles failures gracefully |
| 80 | Production Hardened | Battle-tested, comprehensive resilience patterns |
| 90 | Enterprise Grade | Highly scalable, auditable, operationally excellent |
| 100 | Reference Architecture | Industry-leading, textbook-quality engineering |

## Scorecard (Weighted)

| Category | Weight | Previous | Current | Δ | Weighted Contribution | Observations |
|---|---|---|---|---|---|---|
| … | … | … | … | … | Weight × Current | Short evidence-based note |

## Overall Weighted Score

Previous: X.XX → Current: X.XX (Δ +/-X.XX)

## Regressions vs. Previous

*(Include this section only if prior scores exist and any category dropped.)*

- **Category** — Previous X.X → Current Y.Y — what changed and where (file:line)

## Architecture Map (High Level)

- System components
- Module responsibilities
- Data flow
- Layer boundaries

## Major Strengths

- …

## Anti-Patterns Detected

- …

## New Issues

### ISSUE-NNN — <short title>

`Severity: Critical|High|Medium|Low` · `Priority: P0|P1|P2|P3` · `Effort: S|M|L` · `Category: <category>`

**Description:** …

**Why this matters:** <future risk>

**Suggested Fix:** …

## Refactor Roadmap (Ordered Steps)

1. …
2. …
```

If no previous review exists, leave `Previous` and `Δ` as `N/A` and omit the "Regressions vs. Previous" section.

---

## Step 5: Rewrite Review Files

After generating the review output, **regenerate** all four state files in `<STATE_DIR>`. None of them are append logs.

### 5.1 `<STATE_DIR>/code_review_issues.md` — Rewrite (active issue tracker)

- List only currently **unresolved** issues.
- Keep stable IDs for issues carried over from prior reviews.
- Drop issues that are now fixed.
- Add newly discovered issues with the next sequential ID.
- Include for each: severity, priority, effort, category, file:line, one-line description.

Header line: `Stack: <backend|frontend|tui>`

### 5.2 `<STATE_DIR>/code_review_history.md` — **Rewrite as living document**

A single current-state document, **not** a chronological log.

Structure:

```markdown
# Code Review — Current State

Stack: <backend|frontend|tui>
_Last reviewed: YYYY-MM-DD_

## Maturity
**Level XX — Label**

## Current Scorecard (Weighted)
| Category | Weight | Score | Weighted |
|---|---|---|---|
| … | … | … | … |

**Overall: X.XX**

## Recent Top-Line Scores (for trend)
| Date | Maturity | Overall |
|---|---|---|
| YYYY-MM-DD | XX | X.XX |   ← current
| YYYY-MM-DD | XX | X.XX |   ← previous
| YYYY-MM-DD | XX | X.XX |   ← two reviews ago (optional)

Keep at most **three** rows here. Drop the oldest when a fourth would be added.
```

**Never append.** Each review regenerates this file from scratch.

### 5.3 `<STATE_DIR>/learning.md` — **Rewrite as living document**

A consolidated current-state knowledge base — **not** a history of lessons.

On every review:
1. Start from previous `learning.md` (if any) + newly discovered patterns.
2. **Keep** any entry still verifiable in the current code.
3. **Prune** any entry that is now fixed, refactored away, or no longer applicable.
4. **Merge** duplicates — one entry per distinct pattern/anti-pattern.

Structure:

```markdown
# Architectural Learnings — Current State

Stack: <backend|frontend|tui>
_Last updated: YYYY-MM-DD_

## Active Patterns
- <pattern> — where it applies (file/module) — why it works here

## Active Anti-Patterns
- <anti-pattern> — where it appears — why it is a problem

## Repeated Mistakes
- <mistake> — observed in <module(s)> — recommended corrective direction
```

**Never append.** Each review regenerates this file from scratch.

### 5.4 `<STATE_DIR>/architecture_map.md` — Rewrite (current snapshot)

Rewrite as the current architecture: components, responsibilities, data flow, layer boundaries. Drop anything no longer present in the code. Header: `Stack: <backend|frontend|tui>`.

### Living-Document Rules

- `code_review_history.md` and `learning.md` are **never** appended to — always regenerated.
- Carry forward only items still verifiable in the current code.
- `code_review_history.md` keeps at most the current + two prior top-line score rows (three total).
- If you cannot verify a carried-over learning against current code, drop it.

---

## Step 6: Issue Resolution Workflow

After the review, process issues from `<STATE_DIR>/code_review_issues.md`. If more than 10 issues exist, present a summary table first and let the user pick which to address. Otherwise, walk through them one by one.

For each issue:

```
ISSUE-NNN: <title>
Severity: <X> | Priority: <X> | Effort: <X>

Choose action:
→ FIX IT
→ DEFER
→ CANCEL
```

- **FIX IT** — implement the fix, mark resolved in `code_review_issues.md`, then regenerate `code_review_history.md` and `learning.md` to reflect the new state.
- **DEFER** — mark as deferred with today's date in `code_review_issues.md`. Do not touch history / learning.
- **CANCEL** — remove from `code_review_issues.md`. Do not touch history. If cancellation reveals a generalizable pattern, fold it into `learning.md` on the next regenerate.

Never auto-fix without user approval.

---

## Rules

- Ground every observation in real code (`file:line`). No generic advice, no hypotheticals.
- Be direct. Write like a Principal Architect reviewing production code.
- Treat this as long-term ownership — optimize for the repository's health five years out.
- Recommend committing `.code_review/` to version control so review state persists across contributors.
