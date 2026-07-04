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
  };
}
