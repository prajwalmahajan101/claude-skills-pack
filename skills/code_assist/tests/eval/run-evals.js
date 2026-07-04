#!/usr/bin/env node
"use strict";
// LLM-graded behavioral evals for code_assist. Zero-dep, OPT-IN, TOKEN-COSTING.
//
//   make eval-llm                 # run every case, deterministic asserts + LLM grader
//   node tests/eval/run-evals.js --case debug-no-fix-before-root-cause
//   node tests/eval/run-evals.js --no-grade        # skip the grader (asserts only, cheaper)
//   node tests/eval/run-evals.js --list            # list case ids and exit
//
// Each case drives the real `claude` CLI (`claude -p`) with the family's discipline in scope,
// captures the first response, then judges it two ways:
//   1. deterministic token assertions (forbid / requireAny) — fast, free, no model in the loop.
//   2. an LLM grader against grader.md — subjective adherence score (unless --no-grade).
//
// Requires the `claude` CLI on PATH. eval-llm is opt-in (NOT part of `make all`, which is
// lint+test+eval), so a missing CLI here is a setup failure: it exits NON-ZERO with a loud
// banner by default, making CI gateable. Set CA_EVAL_ALLOW_MISSING=1 to downgrade an absent
// CLI to a green skip (exit 0) for boxes that intentionally lack it.
// Env: CA_EVAL_MODEL (default: let the CLI decide), CA_EVAL_TIMEOUT_MS (default 180000),
//      CA_EVAL_THRESHOLD (grader pass score, default 7), CA_EVAL_ALLOW_MISSING (skip-green if no CLI).

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const HERE = __dirname;
const SKILL_ROOT = path.join(HERE, "..", "..");
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, "evals.json"), "utf8")).cases;
const GRADER = fs.readFileSync(path.join(HERE, "grader.md"), "utf8");

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const NO_GRADE = flag("--no-grade");
const ONLY = opt("--case");
const MODEL = process.env.CA_EVAL_MODEL || "";
const TIMEOUT = Number(process.env.CA_EVAL_TIMEOUT_MS || 180000);
const THRESHOLD = Number(process.env.CA_EVAL_THRESHOLD || 7);

if (flag("--list")) {
  for (const c of CASES) console.log(`${c.id}\t(${c.family})`);
  process.exit(0);
}

// --- claude CLI availability ---------------------------------------------------
function haveClaude() {
  const r = cp.spawnSync("claude", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}
if (!haveClaude()) {
  if (process.env.CA_EVAL_ALLOW_MISSING === "1") {
    console.log("eval-llm: SKIPPED — `claude` CLI absent and CA_EVAL_ALLOW_MISSING=1 (exit 0).");
    process.exit(0);
  }
  console.error("========================================================================");
  console.error("eval-llm FAILED: `claude` CLI not found on PATH — 0 behavioral evals ran.");
  console.error("  Install Claude Code, or set CA_EVAL_ALLOW_MISSING=1 to skip green in CI.");
  console.error("========================================================================");
  process.exit(1);
}

function claude(prompt, systemPrompt) {
  const argv = ["-p"];
  if (systemPrompt) argv.push("--append-system-prompt", systemPrompt);
  if (MODEL) argv.push("--model", MODEL);
  argv.push(prompt);
  const r = cp.spawnSync("claude", argv, { encoding: "utf8", timeout: TIMEOUT, maxBuffer: 32 * 1024 * 1024 });
  if (r.error) return { ok: false, out: "", err: String(r.error.message || r.error) };
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

// Put the family's discipline in scope without hard-coding its prose here.
function skillPreamble(family) {
  return [
    "You have the code_assist skill installed at ~/.claude/skills/code_assist (a symlink to this repo).",
    `Before responding, read these files and follow them exactly:`,
    `  - ~/.claude/skills/code_assist/${family}/ROUTER.md`,
    `  - ~/.claude/skills/code_assist/_shared/discipline.md`,
    `  - ~/.claude/skills/code_assist/_shared/conventions.md`,
    "Then produce ONLY your actual first response to the user's request below — the response the",
    "code_assist skill would give. Do not narrate that you are reading files; just respond as the skill.",
  ].join("\n");
}

// --- deterministic assertions --------------------------------------------------
function runAsserts(out, a) {
  const fails = [];
  const hay = out.toLowerCase();
  for (const bad of a.forbid || []) {
    if (hay.includes(bad.toLowerCase())) fails.push(`forbidden token present: "${bad}"`);
  }
  if (a.requireAny && a.requireAny.length) {
    const hit = a.requireAny.some((t) => hay.includes(t.toLowerCase()));
    if (!hit) fails.push(`none of requireAny present: ${JSON.stringify(a.requireAny)}`);
  }
  return fails;
}

// --- LLM grader ----------------------------------------------------------------
function grade(c, out) {
  const payload = [
    `family: ${c.family}`,
    `prompt: ${c.prompt}`,
    `rubric: ${c.rubric}`,
    "response:",
    "---",
    out,
    "---",
  ].join("\n");
  const r = claude(payload, GRADER);
  if (!r.ok) return { score: 0, verdict: "fail", reasons: ["grader call failed: " + (r.err || "no output")] };
  const m = r.out.match(/\{[\s\S]*\}/);
  if (!m) return { score: 0, verdict: "fail", reasons: ["grader returned no JSON: " + r.out.slice(0, 200)] };
  try {
    const v = JSON.parse(m[0]);
    if (typeof v.score !== "number") v.score = 0;
    if (!v.verdict) v.verdict = v.score >= THRESHOLD ? "pass" : "fail";
    return v;
  } catch (e) {
    return { score: 0, verdict: "fail", reasons: ["grader JSON parse error: " + e.message] };
  }
}

// --- run -----------------------------------------------------------------------
const selected = ONLY ? CASES.filter((c) => c.id === ONLY) : CASES;
if (ONLY && !selected.length) { console.error(`no such case: ${ONLY}`); process.exit(2); }

console.log(`eval-llm: ${selected.length} case(s), grader=${NO_GRADE ? "off" : "on"}, threshold=${THRESHOLD}`);
console.log(`skill root: ${SKILL_ROOT}\n`);

const results = [];
for (const c of selected) {
  process.stdout.write(`▶ ${c.id} (${c.family}) ... `);
  const resp = claude(c.prompt, skillPreamble(c.family));
  if (!resp.ok) {
    console.log("ERROR");
    results.push({ id: c.id, pass: false, note: "claude -p failed: " + (resp.err || "no output") });
    continue;
  }
  const assertFails = runAsserts(resp.out, c.assert || {});
  let g = null;
  if (!NO_GRADE) g = grade(c, resp.out);
  const pass = assertFails.length === 0 && (NO_GRADE || (g && g.verdict === "pass"));
  console.log(pass ? "PASS" : "FAIL");
  results.push({
    id: c.id,
    pass,
    assertFails,
    score: g ? g.score : null,
    verdict: g ? g.verdict : null,
    reasons: g ? g.reasons : null,
  });
}

// --- report --------------------------------------------------------------------
console.log("\n=== summary ===");
let passed = 0;
for (const r of results) {
  const tag = r.pass ? "PASS" : "FAIL";
  const score = r.score != null ? ` score=${r.score}` : "";
  console.log(`  [${tag}] ${r.id}${score}`);
  if (!r.pass) {
    for (const f of r.assertFails || []) console.log(`         assert: ${f}`);
    for (const rr of r.reasons || []) console.log(`         grader: ${rr}`);
    if (r.note) console.log(`         ${r.note}`);
  }
  if (r.pass) passed++;
}
console.log(`\neval-llm: ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
