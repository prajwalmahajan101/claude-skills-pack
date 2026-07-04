#!/usr/bin/env node
"use strict";
// ca-session-start — SessionStart hook. Prints a one-block orientation for the repo:
// the .code_assist/STATE.md "Now" line (only when STATE.md exists), the structure compliance
// score (always, inside a repo), and up to 2 repo-scoped **risks** pulled from harness memory
// via `ca-tools recall`. Silent OUTSIDE a git repo, and silent if it has
// literally nothing to show, so it never adds noise to non-repo dirs.
//
// Gated by CA_DISABLE=1. Never blocks the session; any error exits 0 quietly.

if (process.env.CA_DISABLE === "1") process.exit(0);

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

try { main(); } catch (e) { logErr(e); process.exit(0); }

function main() {
  const hook = safeJSON(readStdin());
  const cwd = hook.cwd || process.cwd();

  // Only speak inside a git repo.
  if (!isGitRepo(cwd)) process.exit(0);

  const lines = [];

  // 1. STATE.md "Now" — the current focus the last session left behind.
  const now = readStateNow(cwd);
  if (now) lines.push(`**Now:** ${now}`);

  // 2. Structure compliance score (best-effort via the deterministic backbone).
  const audit = auditStructure(cwd);
  if (audit && typeof audit.compliance_score === "number") {
    const errs = (audit.gaps || []).filter((g) => g.severity === "error").length;
    const tail = errs ? ` — ${errs} required gap${errs === 1 ? "" : "s"}` : "";
    lines.push(`**Structure:** ${audit.compliance_score}/100 compliant${tail}` +
      (errs ? " (`/code_assist:structure` to audit)" : ""));
  }

  // 3. Top repo-scoped risks from harness memory (via `ca-tools recall`).
  for (const r of topRisks(cwd)) lines.push(`**Risk:** ${r.text} \`${r.ref.split("/").pop()}\``);

  if (!lines.length) process.exit(0);

  const context = ["code_assist orientation:", ...lines].join("\n");
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  }));
  process.exit(0);
}

function isGitRepo(cwd) {
  const r = cp.spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  return r.status === 0 && (r.stdout || "").trim() === "true";
}

function readStateNow(cwd) {
  const p = path.join(cwd, ".code_assist", "STATE.md");
  let body;
  try { body = fs.readFileSync(p, "utf8"); } catch { return ""; }
  // Grab the first non-empty content line under a "## Now" heading.
  const m = body.match(/^##+\s*Now\b[^\n]*\n([\s\S]*?)(?:\n##+\s|\n*$)/im);
  if (!m) return "";
  for (const raw of m[1].split("\n")) {
    const line = raw.replace(/^[-*]\s*/, "").trim();
    if (line) return line.slice(0, 200);
  }
  return "";
}

function topRisks(cwd) {
  // Repo-scoped risks only (memory source), keyword-biased by repo name + branch.
  try {
    const tools = require(path.join(__dirname, "..", "bin", "ca-tools.js"));
    if (!tools || typeof tools.recall !== "function") return [];
    // No --context: a risk in THIS project's own memory is inherently relevant, so surface it
    // unconditionally (repo-scoped). Global lessons are excluded below (would be noise).
    const r = tools.recall(["--kinds", "risks", "--limit", "8", "--dir", cwd]);
    return (r.risks || []).filter((x) => x.source === "memory").slice(0, 2)
      .map((x) => ({ text: x.text.slice(0, 120), ref: x.ref }));
  } catch { return []; }
}

function auditStructure(cwd) {
  // Prefer an in-process call to the backbone; fall back to spawning it.
  try {
    const tools = require(path.join(__dirname, "..", "bin", "ca-tools.js"));
    if (tools && typeof tools.structureAudit === "function") return tools.structureAudit(cwd);
  } catch {}
  try {
    const bin = path.join(__dirname, "..", "bin", "ca-tools.js");
    const r = cp.spawnSync("node", [bin, "structure-audit", cwd], { encoding: "utf8" });
    if (r.status === 0) return JSON.parse(r.stdout);
  } catch {}
  return null;
}

function readStdin() { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } }
function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }
function logErr(e) {
  try {
    const log = path.join(require("node:os").homedir(), ".claude", "cache", "ca-session-start.log");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `${new Date().toISOString()} ERROR ${e.stack || e.message}\n`);
  } catch {}
}
