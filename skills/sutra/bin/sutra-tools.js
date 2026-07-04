#!/usr/bin/env node
"use strict";
/*
 * sutra-tools.js — the orchestrator's deterministic backbone.
 *
 * Zero external dependencies (Node >= 18 built-ins only). sutra owns everything
 * that lives BETWEEN the pack's members (code_assist, sb, unabridged); the
 * members themselves stay fully standalone and never reference each other.
 *
 * This CLI is the single source of exact cross-plugin logic:
 *   - the capability registry (which members are present + what they can do),
 *   - the artifact interchange schema conformance check,
 *   - the fused recall (a member's own recall + sb's vault highlights),
 *   - the artifact→vault sync payload builder,
 *   - the verify/plan/incident feedback-loop event log.
 *
 * Every subcommand prints JSON to stdout (parse with jq) unless --text is given.
 * Nothing here is a hard dependency: a missing member makes its handoff a no-op.
 *
 * Usage: node sutra-tools.js <command> [args]
 *   registry                      resolve pack members + versions + capabilities
 *   selfcheck                     registry + orchestrator config, one shot
 *   bridge status                 per-handoff availability (artifact-sync, recall-fusion)
 *   recall --context "<text>"     fused recall: member base stores + sb vault highlights
 *   sync-artifacts <repo>         parse .journal/.code_review/ADRs → vault-ingest payload
 *   schema-check <repo>           conformance of member output vs schema/*.spec.md
 *   loop-emit --event E --note N  record a feedback event (verify/plan/incident outcome)
 *   version                       print tool version
 */

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const os = require("node:os");

const VERSION = "0.1.0";

// Skill layout: <skillRoot>/bin/sutra-tools.js  →  skillRoot is one level up.
const SKILL_ROOT = path.dirname(__dirname);
const PACK_ROOT = path.dirname(SKILL_ROOT); // the `skills/` dir in dev checkouts

// ---------------------------------------------------------------------------
// arg parsing + io (mirrors ca-tools conventions)
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);

function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function out(obj, opts = {}) {
  if (opts.text) process.stdout.write(String(obj) + "\n");
  else process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}
function die(msg, code = 1) { process.stderr.write("sutra-tools: " + msg + "\n"); process.exit(code); }

function sh(command, args, opts = {}) {
  const r = cp.spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...opts });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim(), error: r.error };
}

function safeJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

// ---------------------------------------------------------------------------
// registry — resolve which pack members are present + their versions.
// A member is "present" if its skill dir resolves either installed
// (~/.claude/skills/<id>) or in a dev checkout (sibling of this skill dir).
// Members never detect each other; this is the ONLY place presence is decided.
// ---------------------------------------------------------------------------
function membersFile() {
  return path.join(SKILL_ROOT, "registry", "members.json");
}

function loadMembers() {
  const m = safeJSON(membersFile());
  if (!m || !Array.isArray(m.members)) die("registry/members.json missing or malformed", 3);
  return m;
}

// Resolve a member's on-disk skill dir, preferring an installed symlink, then a
// dev-checkout sibling. Returns { dir, mode } or null when absent.
//
// SUTRA_SKILLS_DIR overrides the installed root AND, when set, makes that root
// authoritative — the dev-sibling fallback is skipped so tests can pin an exact
// set of present members.
function resolveMember(id) {
  const pinned = process.env.SUTRA_SKILLS_DIR;
  const installedRoot = pinned || path.join(os.homedir(), ".claude", "skills");
  const installed = path.join(installedRoot, id);
  if (fs.existsSync(installed)) return { dir: installed, mode: "installed" };
  if (pinned) return null; // pinned root is authoritative
  const dev = path.join(PACK_ROOT, id);
  if (fs.existsSync(dev) && dev !== path.join(PACK_ROOT, path.basename(SKILL_ROOT))) {
    return { dir: dev, mode: "dev" };
  }
  return null;
}

function memberVersion(dir) {
  const pj = safeJSON(path.join(dir, ".claude-plugin", "plugin.json"));
  return pj && pj.version ? pj.version : null;
}

function registry() {
  const spec = loadMembers();
  const members = spec.members.map((m) => {
    const r = resolveMember(m.id);
    return {
      id: m.id,
      role: m.role,
      present: !!r,
      mode: r ? r.mode : null,
      version: r ? memberVersion(r.dir) : null,
      capabilities: m.capabilities || [],
      produces: m.produces || [],
      consumes: m.consumes || [],
    };
  });
  const present = members.filter((m) => m.present).map((m) => m.id);
  return { schemaVersion: spec.schemaVersion, present, members };
}

// Which member (if any) declares a capability — used by the command surface to
// route a /sutra:X to its owning member.
function memberFor(capability) {
  const reg = registry();
  return reg.members.find((m) => m.present && m.capabilities.includes(capability)) || null;
}

// ---------------------------------------------------------------------------
// schema-check — conformance of member artifact output vs schema/*.spec.md.
// Sutra OWNS the interchange schema; code_assist writes its own format
// standalone, so this catches drift here rather than coupling the producer.
// Deterministic, read-only. See schema/{journal,adr,review}.spec.md.
// ---------------------------------------------------------------------------
function repoRoot(dir) {
  const r = sh("git", ["-C", dir || ".", "rev-parse", "--show-toplevel"]);
  return r.status === 0 && r.stdout ? r.stdout : path.resolve(dir || ".");
}

const JOURNAL_FILE = /^M[0-9]+(\.[0-9]+)*\.md$/;
const ADR_FILE = /^[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$/;
const ISSUE_HEAD = /^###\s+ISSUE-[0-9]+\s+[—-]\s+.+/;
const ISSUE_SEV = /Severity:\s*(Critical|High|Medium|Low)\b/i;
const ISSUE_PRI = /Priority:\s*(P[0-3])\b/i;

function checkJournals(root) {
  const dir = path.join(root, ".journal");
  const res = { found: 0, conforming: 0, violations: [], warnings: [] };
  if (!fs.existsSync(dir)) return res;
  for (const f of fs.readdirSync(dir)) {
    if (f === "TEMPLATE.md" || !f.endsWith(".md")) continue;
    if (!JOURNAL_FILE.test(f)) { res.violations.push(`${f}: filename does not match M<phase>.md`); continue; }
    res.found++;
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    const firstH1 = (body.split("\n").find((l) => l.trim().startsWith("# ")) || "").trim();
    if (!/^#\s+M[0-9]+(\.[0-9]+)*\b/.test(firstH1)) { res.violations.push(`${f}: missing '# M<phase>' H1 header`); continue; }
    if (!body.replace(firstH1, "").trim()) { res.violations.push(`${f}: no body content`); continue; }
    res.conforming++;
  }
  return res;
}

function checkAdrs(root) {
  const dir = path.join(root, "docs", "adr");
  const res = { found: 0, conforming: 0, violations: [], warnings: [] };
  if (!fs.existsSync(dir)) return res;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "0000-template.md" || f === "INDEX.md" || f === "index.md") continue;
    if (!ADR_FILE.test(f)) { res.warnings.push(`${f}: filename not NNNN-slug.md (skipped)`); continue; }
    res.found++;
    const num = f.slice(0, 4);
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    const problems = [];
    // Accept both canonical `# NNNN. title` and the common `# ADR NNNN: title`
    // variant; require only that the filename number appears in the H1.
    const h1 = (body.split("\n").find((l) => l.startsWith("# ")) || "").trim();
    if (!new RegExp(`^#\\s+(ADR\\s+)?0*${Number(num)}\\b`, "i").test(h1)) problems.push("H1 number mismatches filename");
    // Status/Date lines may use bold labels (`- **Status:**`) and either casing.
    if (!/^-\s*\*{0,2}Status:?\*{0,2}\s*(proposed|accepted|superseded)\b/im.test(body)) problems.push("missing/invalid Status line");
    if (!/\*{0,2}Date:?\*{0,2}\s*\d{4}-\d{2}-\d{2}\b/im.test(body)) problems.push("missing/invalid Date line");
    for (const sec of ["Context", "Decision", "Consequences", "Usage"]) {
      if (!new RegExp(`^##\\s+${sec}\\b`, "im").test(body)) problems.push(`missing ## ${sec}`);
    }
    if (problems.length) res.violations.push(`${f}: ${problems.join("; ")}`);
    else res.conforming++;
  }
  return res;
}

function checkReviews(root) {
  const base = path.join(root, ".code_review");
  const res = { found: 0, conforming: 0, violations: [], warnings: [] };
  if (!fs.existsSync(base)) return res;
  // Collect every code_review_issues.md (flat + per-stack).
  const issueFiles = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "code_review_issues.md") issueFiles.push(p);
    }
  })(base);
  for (const p of issueFiles) {
    res.found++;
    const rel = path.relative(root, p);
    const body = fs.readFileSync(p, "utf8");
    const active = body.split(/^##\s+Resolved\b/im)[0]; // stop at Resolved section
    const lines = active.split("\n");
    let issueProblems = 0;
    for (let i = 0; i < lines.length; i++) {
      if (!ISSUE_HEAD.test(lines[i])) continue;
      const block = lines.slice(i + 1, i + 8).join("\n");
      if (!ISSUE_SEV.test(block) || !ISSUE_PRI.test(block)) {
        res.violations.push(`${rel}: ${lines[i].trim().slice(0, 60)} — missing valid Severity/Priority`);
        issueProblems++;
      }
    }
    if (!issueProblems) res.conforming++;
  }
  return res;
}

function schemaCheck(dir) {
  const root = repoRoot(dir);
  const journal = checkJournals(root);
  const adr = checkAdrs(root);
  const review = checkReviews(root);
  const ok = !journal.violations.length && !adr.violations.length && !review.violations.length;
  return { dir: root, ok, journal, adr, review };
}

// ---------------------------------------------------------------------------
// bridge core — the cross-plugin seams sutra owns. Every one is a no-op when its
// member is absent (a missing member is never a hard dependency).
// ---------------------------------------------------------------------------
const artifacts = require(path.join(SKILL_ROOT, "lib", "artifacts.js"));

// Resolve a file inside a present member's skill dir, or null.
function memberPath(id, ...rel) {
  const r = resolveMember(id);
  if (!r) return null;
  const p = path.join(r.dir, ...rel);
  return fs.existsSync(p) ? p : null;
}

// sync-artifacts — parse a repo's member artifacts into a vault-ingest payload.
// The forward bridge: code_assist produces, sutra parses, sb ingests.
function syncArtifacts(dir, project) {
  const root = artifacts.repoRoot(dir || ".") || repoRoot(dir || ".");
  const payload = artifacts.buildVaultPayload(root, project);
  const sb = resolveMember("sb");
  return {
    ok: true,
    consumer: { sb: !!sb, note: sb ? "feed `notes` to sb's ingest primitive" : "sb absent — payload built but not ingested" },
    ...payload,
  };
}

// normalize text for dedup (trim + lowercase + collapse whitespace).
function normText(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
// cheap relevance: count context tokens (>=3 chars) that appear in the text.
function overlap(ctxToks, text) {
  if (!ctxToks.length) return 0;
  const t = new Set(String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  let n = 0;
  for (const c of ctxToks) if (t.has(c)) n++;
  return n;
}

// recall (fused) — the reverse bridge. Compose the members' own knowledge:
// code_assist's base recall (harness stores: lessons/memory/risks) + sb's vault
// highlights. sutra never re-implements a member's recall; it drives + merges,
// then re-ranks by relevance so vault hits compete fairly with base lessons.
// --timeout <ms> bounds each member child (callers like the session hook pass a
// tight cap so they never depend on the default 8s).
function recallFused(args) {
  const f = flags(args);
  const context = f.context || f._.join(" ") || "";
  const limit = Number(f.limit || 5);
  const dir = f.dir || ".";
  const timeout = Number(f.timeout || 8000);
  const sources = { code_assist: false, sb: false };
  let lessons = [], risks = [], memory = [];

  // Base: code_assist's own recall (its files are the source of truth). Pull a
  // bit deeper than `limit` so the re-rank + dedup below has room to work.
  const caCli = memberPath("code_assist", "bin", "ca-tools.js");
  if (caCli) {
    sources.code_assist = true;
    const r = sh("node", [caCli, "recall", "--context", context, "--limit", String(limit * 2), "--dir", dir], { timeout });
    if (r.status === 0 && r.stdout) {
      try {
        const base = JSON.parse(r.stdout);
        lessons = (base.lessons || []).map((x, i) => ({ ...x, source: x.source || "code_assist", _rank: i }));
        risks = base.risks || [];
        memory = base.memory || [];
      } catch {}
    }
  }

  // Layer: sb's vault highlights (verbatim, with provenance).
  const sbCli = memberPath("sb", "commands", "_runners", "ask-highlights.js");
  if (sbCli && context) {
    sources.sb = true;
    const r = sh("node", [sbCli, context, "--limit", String(limit)], { timeout });
    if (r.status === 0 && r.stdout) {
      const lines = r.stdout.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].match(/^•\s*(.+)$/);
        if (!t) continue;
        const ref = (lines[i + 1] || "").match(/—\s*(.+:\d+)\s*$/);
        lessons.push({ text: t[1].trim(), source: "sb", ref: ref ? ref[1] : "sb:vault", _rank: i });
      }
    }
  }

  // Merge: dedup (normalized) across lessons + drop any that duplicate a risk;
  // score by context overlap; stable-sort by score desc, then member rank asc.
  const ctxToks = [...new Set(String(context).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3))];
  const riskKeys = new Set(risks.map((r) => normText(r.text)));
  const seen = new Set();
  const merged = [];
  for (const l of lessons) {
    const k = normText(l.text);
    if (!k || seen.has(k) || riskKeys.has(k)) continue;
    seen.add(k);
    merged.push({ ...l, _score: context ? overlap(ctxToks, l.text) : 0 });
  }
  merged.sort((a, b) => (b._score - a._score) || (a._rank - b._rank));

  const strip = (arr) => arr.map(({ _score, _rank, ...rest }) => rest);
  const clip = (a) => a.slice(0, limit);
  return { context, sources, lessons: clip(strip(merged)), risks: clip(risks), memory: clip(memory) };
}

// bridge status — registry-based handoff availability (observable, no-op-safe).
function bridge(args) {
  const sub = flags(args)._[0] || "status";
  if (sub !== "status") return { ok: false, reason: "usage: bridge <status>" };
  const reg = registry();
  const has = (id) => reg.present.includes(id);
  return {
    present: reg.present,
    handoffs: {
      "artifact-sync": has("sb")
        ? "code_assist artifacts (.journal/.code_review/docs/adr) → sutra parses → sb vault ingests"
        : "sb absent — artifacts still built by sync-artifacts, not ingested",
      "recall-fusion": {
        base: has("code_assist") ? "code_assist recall (harness stores)" : "code_assist absent",
        vault: has("sb") ? "sb vault highlights" : "sb absent",
        available: has("code_assist") || has("sb"),
      },
      "output-discipline": has("unabridged") ? "full-output steps honor unabridged" : "unabridged absent (optional)",
    },
    schema: "sutra owns the interchange schema (schema-check enforces conformance)",
  };
}

// loop-emit — record a feedback event (verify/plan/incident outcome). The closed
// loop: writing an outcome feeds the pull-back so recall surfaces it next time.
// Durable, deterministic; the command layer offers to promote it to an sb lesson.
function loopEmit(args) {
  const f = flags(args);
  const event = f.event || f._[0];
  if (!event) return { ok: false, reason: "usage: loop-emit --event <verify|plan|incident|...> [--note <text>] [--risk]" };
  const root = artifacts.repoRoot(f.dir || ".") || repoRoot(f.dir || ".");
  const dir = path.join(root, ".sutra");
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, "loop.jsonl");
  const entry = { ts: new Date().toISOString(), event, note: f.note || "", risk: !!f.risk };
  fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  return { ok: true, logged: logFile, entry, suggest: resolveMember("sb") ? "promote to /sutra:capture (sb lesson)" : null };
}

// ---------------------------------------------------------------------------
// selfcheck — registry + orchestrator config in one shot
// ---------------------------------------------------------------------------
function selfcheck() {
  const reg = registry();
  return {
    name: "sutra",
    version: VERSION,
    skillRoot: SKILL_ROOT,
    present: reg.present,
    members: reg.members.map((m) => ({ id: m.id, present: m.present, version: m.version, mode: m.mode })),
  };
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------
function printUsage() {
  const src = fs.readFileSync(__filename, "utf8");
  const m = src.match(/\*\s*Usage:[\s\S]*?(?=\n \*\/)/);
  process.stdout.write((m ? m[0].replace(/^ \* ?/gm, "").replace(/^\*/, "") : "sutra-tools <command> — see header") + "\n");
}

async function main() {
  switch (cmd) {
    case "help": case "--help": case "-h": return printUsage();
    case "version": return out({ name: "sutra-tools", version: VERSION });
    case "registry": return out(registry());
    case "selfcheck": return out(selfcheck());
    case "schema-check": {
      const res = schemaCheck(flags(rest)._[0] || ".");
      if (flags(rest)["exit-code"]) process.exit(res.ok ? 0 : 1);
      return out(res);
    }
    case "bridge": return out(bridge(rest));
    case "recall": return out(recallFused(rest));
    case "sync-artifacts": return out(syncArtifacts(flags(rest)._[0] || ".", flags(rest).project));
    case "loop-emit": return out(loopEmit(rest));
    case undefined: return die("no command. see header for usage.", 2);
    default: return die("unknown command: " + cmd, 2);
  }
}

if (require.main === module) {
  main().catch((e) => die(e.stack || String(e)));
} else {
  module.exports = {
    flags, safeJSON, resolveMember, memberVersion, loadMembers,
    registry, memberFor, selfcheck, VERSION, SKILL_ROOT, PACK_ROOT,
    repoRoot, checkJournals, checkAdrs, checkReviews, schemaCheck,
    memberPath, syncArtifacts, recallFused, bridge, loopEmit, artifacts,
  };
}
