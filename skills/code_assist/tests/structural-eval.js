#!/usr/bin/env node
"use strict";
// Structural eval — asserts the skill tree is internally consistent. Zero-dep.
// Exits non-zero on any failure (CI-ready). Run: node tests/structural-eval.js
//
// Checks:
//  1. Every commands/*.md references a family file that exists.
//  2. Every family <dir>/ROUTER.md loads _shared/discipline.md.
//  3. SKILL.md router rows point at real ROUTER.md files.
//  4. No placeholder leakage (delegates to unabridged check_placeholders.sh if present).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const fails = [];
const oks = [];
function ok(m) { oks.push(m); }
function fail(m) { fails.push(m); }
function read(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }

// 1. commands -> family file resolves
const cmdDir = path.join(ROOT, "commands");
for (const f of fs.readdirSync(cmdDir).filter((x) => x.endsWith(".md"))) {
  const body = read(path.join(cmdDir, f));
  const m = body.match(/~\/\.claude\/skills\/code_assist\/([A-Za-z0-9_./-]+\.md)/);
  if (!m) continue; // some commands (git_commit/journal) may reference differently
  const target = path.join(ROOT, m[1]);
  if (fs.existsSync(target)) ok(`command ${f} -> ${m[1]}`);
  else fail(`command ${f} references missing ${m[1]}`);
}

// 2. every family ROUTER.md loads discipline (families that have a ROUTER)
const FAMILY_DIRS = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !["bin", "_shared", "commands", "agents", "tests",
    "structure", "domains", "orchestrator", ".claude-plugin", "hooks", "bridge", "git-commit",
    "code-review", "journal"].includes(e.name))
  .map((e) => e.name);
// explicit families with routers (new + integration) that must load discipline
const MUST_DISCIPLINE = ["plan", "debug", "adr", "verify", "structure", "format",
  "github", "track", "notify", "scan", "release"];
for (const fam of MUST_DISCIPLINE) {
  const r = path.join(ROOT, fam, "ROUTER.md");
  if (!fs.existsSync(r)) { fail(`family ${fam} missing ROUTER.md`); continue; }
  if (read(r).includes("_shared/discipline.md")) ok(`${fam} loads discipline`);
  else fail(`${fam}/ROUTER.md does not load _shared/discipline.md`);
}

// 3. SKILL.md router rows point at real ROUTER.md
const skill = read(path.join(ROOT, "SKILL.md"));
for (const m of skill.matchAll(/`([a-z-]+\/ROUTER\.md)`/g)) {
  const target = path.join(ROOT, m[1]);
  if (fs.existsSync(target)) ok(`SKILL.md -> ${m[1]}`);
  else fail(`SKILL.md references missing ${m[1]}`);
}

// 4. placeholder leakage (best-effort; skip if the checker is absent)
const checker = path.join(os.homedir(), ".claude", "skills", "unabridged", "scripts", "check_placeholders.sh");
if (fs.existsSync(checker)) {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(md|js)$/.test(e.name) && !full.includes("/templates/")) files.push(full);
    }
  })(ROOT);
  const r = cp.spawnSync("bash", [checker, ...files], { encoding: "utf8" });
  if (r.status === 0) ok(`placeholder check clean (${files.length} files)`);
  else fail(`placeholder leakage:\n${(r.stdout || "") + (r.stderr || "")}`);
} else {
  ok("placeholder check skipped (unabridged not installed)");
}

// report
console.log(`structural-eval: ${oks.length} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error("  FAIL: " + f);
  process.exit(1);
}
console.log("  all structural checks passed.");
