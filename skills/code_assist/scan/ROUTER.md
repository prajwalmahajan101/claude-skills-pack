---
name: code_assist/scan/ROUTER
description: Static-analysis integration - pull SonarQube findings (read-only) and run Semgrep if installed. Wires into code-review as a pre-pass. Reads env tokens; no MCP.
type: router
---

# Scan Router

Load `_shared/discipline.md` first.

Read-only static-analysis pull. Config via env: `SONAR_HOST_URL` + `SONAR_TOKEN`
(+ `SONAR_PROJECT_KEY` or `--project`).

| Action | How |
|---|---|
| SonarQube open issues | `node bin/ca-tools.js scan sonar [--project KEY]` |
| Semgrep (if installed) | `semgrep scan --config auto` (optional; skip if absent) |

## Rules
- Read-only - never mutates the Sonar project.
- No host/token -> no-op with a setup hint.
- **Review pre-pass**: run before `code-review` and fold findings into the review's Step 3
  detection checklist (treat security findings as blocking, style as informational - matches
  the project's static-analysis policy).
- Feeds the orchestrator `land` chain.
