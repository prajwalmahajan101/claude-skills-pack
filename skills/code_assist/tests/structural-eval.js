#!/usr/bin/env node
"use strict";
// Structural eval — asserts the skill tree is internally consistent. Zero-dep.
// Exits non-zero on any failure (CI-ready). Run: node tests/structural-eval.js
//
// Checks:
//  1. Every commands/*.md references a family file that exists.
//  2. Every family <dir>/ROUTER.md loads _shared/discipline.md.
//  3. SKILL.md router rows point at real ROUTER.md files.
//  4. No placeholder leakage (self-contained conservative marker scan).

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

// 2. every family ROUTER.md must load discipline, EXCEPT an explicit exempt set.
// Derived from disk (not a hardcoded include-list), so a NEW family that forgets
// _shared/discipline.md is caught by default — only known exemptions are listed.
const DISCIPLINE_EXEMPT = new Set([
  "code-review", "domains", "git-commit", "graph", "journal", "onboard", "refactor", "test",
]);
const routerFamilies = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(ROOT, e.name, "ROUTER.md")))
  .map((e) => e.name);
for (const fam of routerFamilies) {
  const r = path.join(ROOT, fam, "ROUTER.md");
  if (DISCIPLINE_EXEMPT.has(fam)) { ok(`${fam} exempt from discipline (documented)`); continue; }
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

// 4. placeholder leakage — code_assist owns its own guarantee (self-contained,
// no cross-skill dependency). Conservative markers only, to avoid false positives
// on legitimate prose.
const PLACEHOLDER = /\b(for brevity|rest of (the )?(code|file|implementation|function)s?\s+(omitted|here|elided)|\.\.\.\s*\(truncated\)|<placeholder>|TODO:\s*implement this)\b/i;
{
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(md|js)$/.test(e.name) && !full.includes("/templates/") && full !== __filename) files.push(full);
    }
  })(ROOT);
  const leaks = [];
  for (const fp of files) {
    const body = read(fp);
    const line = body.split("\n").find((l) => PLACEHOLDER.test(l));
    if (line) leaks.push(`${path.relative(ROOT, fp)}: ${line.trim().slice(0, 80)}`);
  }
  if (!leaks.length) ok(`placeholder check clean (${files.length} files)`);
  else fail(`placeholder leakage:\n  ${leaks.join("\n  ")}`);
}

// 5. plugin manifests + hooks are present and valid JSON
function checkJSON(rel, label) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fail(`${label} missing: ${rel}`); return; }
  try { JSON.parse(read(p)); ok(`${label} valid: ${rel}`); }
  catch (e) { fail(`${label} invalid JSON: ${rel} (${e.message})`); }
}
checkJSON(".claude-plugin/plugin.json", "plugin manifest");
checkJSON("hooks/hooks.json", "hooks manifest");
// repo-root marketplace (two levels up from the skill dir)
const marketplace = path.join(ROOT, "..", "..", ".claude-plugin", "marketplace.json");
if (fs.existsSync(marketplace)) {
  try { JSON.parse(read(marketplace)); ok("marketplace.json valid"); }
  catch (e) { fail(`marketplace.json invalid JSON (${e.message})`); }
} else ok("marketplace.json check skipped (not in pack layout)");
// hook scripts exist
for (const h of ["hooks/ca-session-start.js", "hooks/ca-git-guard.js"]) {
  if (fs.existsSync(path.join(ROOT, h))) ok(`present: ${h}`);
  else fail(`missing: ${h}`);
}

// report
console.log(`structural-eval: ${oks.length} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error("  FAIL: " + f);
  process.exit(1);
}
console.log("  all structural checks passed.");
