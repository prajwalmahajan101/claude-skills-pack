#!/usr/bin/env node
"use strict";
// ca-git-guard — PreToolUse hook on Bash. Deterministically enforces the
// _shared/conventions.md guardrails that an LLM can forget under pressure:
//   1. no `git commit` while on main/master/develop (feature-branch rule),
//   2. no blanket `git add .` / `git add -A` / `git add --all` (atomic-staging rule),
//   3. no `--no-verify` (do not skip lint/test/commit hooks).
//
// Default: WARN only — emits a note on stderr and exits 0, so the commit still runs.
// Under CA_GIT_GUARD_STRICT=1 it hard-blocks (exit 2, stderr fed back to the model).
// Gated by CA_DISABLE=1. Anything it cannot parse is allowed through (exit 0).

if (process.env.CA_DISABLE === "1") process.exit(0);

const fs = require("node:fs");
const cp = require("node:child_process");

const STRICT = process.env.CA_GIT_GUARD_STRICT === "1";

try { main(); } catch { process.exit(0); }

function main() {
  const hook = safeJSON(readStdin());
  if ((hook.tool_name || hook.toolName) !== "Bash") process.exit(0);
  const cmd = (hook.tool_input || hook.toolInput || {}).command || "";
  if (!cmd) process.exit(0);

  const cwd = hook.cwd || process.cwd();
  const warnings = [];

  const isCommit = /\bgit\b[^\n&|;]*\bcommit\b/.test(cmd);
  if (isCommit) {
    const branch = currentBranch(cwd);
    if (branch && /^(main|master|develop)$/.test(branch)) {
      warnings.push(`commit targets protected branch '${branch}'. Create a feature branch first ` +
        `(git switch -c <type>/<slug>) — see _shared/conventions.md.`);
    }
  }

  if (/\bgit\s+add\s+(?:-A\b|--all\b|\.(?:\s|$))/.test(cmd)) {
    warnings.push("blanket `git add` stages everything — code_assist commits are atomic. " +
      "Stage per logical change (git add <paths>) via /code_assist:git_commit.");
  }

  if (/--no-verify\b/.test(cmd)) {
    warnings.push("`--no-verify` skips lint/test/commit hooks. Fix the failure instead of bypassing it.");
  }

  if (!warnings.length) process.exit(0);

  const label = STRICT ? "BLOCKED" : "WARN";
  const note = [`code_assist git-guard ${label}:`, ...warnings.map((w) => "  - " + w)].join("\n");
  process.stderr.write(note + "\n");
  process.exit(STRICT ? 2 : 0);
}

function currentBranch(cwd) {
  const r = cp.spawnSync("git", ["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  return r.status === 0 ? (r.stdout || "").trim() : "";
}

function readStdin() { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } }
function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }
