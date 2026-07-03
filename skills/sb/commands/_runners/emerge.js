#!/usr/bin/env node
// emerge.js — surface emergent patterns across notes and draft synthesis pages.
// Usage: emerge.js [--apply] [--min N]
//
// Clusters lessons / zettels / topics by shared tag or repeated title token. For
// each cluster of >= N notes (default 3) that has no synthesis page yet, Haiku
// names the pattern and drafts a `type: synthesis`, `verified: false` note in
// 08_Insights/ linking the members. Deterministic clustering; Haiku only names +
// summarizes. Dry-run by default (reports candidate clusters); `--apply` writes.
// Dedup is tracked in _meta/synthesis-seen.json so re-runs never duplicate.
// Called by /sb:consolidate --apply.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, paths, slugify } = require(path.join(SKILL_LIB, "vault.js"));
const { fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock, unverifiedFront, aiCallout } = require(path.join(SKILL_LIB, "ai-first.js"));
const { loadIndex, tokens } = require(path.join(SKILL_LIB, "retriever.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const MODEL = process.env.SB_ANALYZER_MODEL || "claude-haiku-4-5-20251001";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const MIN = flagNum(args, "--min", 3);

const P = paths("_");
const SEEN_FILE = path.join(P.meta, "synthesis-seen.json");
const seen = loadSeen();

const CLUSTER_TYPES = new Set(["lessons", "zettel", "topics"]);
const notes = loadIndex().filter((n) => CLUSTER_TYPES.has(n.type));

const clusters = buildClusters(notes, MIN).filter((c) => !seen[c.key]);

if (!clusters.length) {
  console.log(`No new >=${MIN}-note clusters lacking a synthesis page. (${Object.keys(seen).length} already synthesized.)`);
  process.exit(0);
}

console.log(`${APPLY ? "Applying" : "Dry-run"} — ${clusters.length} candidate cluster(s):\n`);
let wrote = 0;
for (const c of clusters) {
  console.log(`  [${c.label}] ${c.members.length} notes: ${c.members.map((m) => path.basename(m.rel, ".md")).join(", ")}`);
  if (!APPLY) continue;
  const named = nameCluster(c);
  const file = writeSynthesis(c, named);
  seen[c.key] = { file: path.relative(VAULT, file), members: c.members.map((m) => m.rel), at: today() };
  wrote++;
  console.log(`    -> ${path.relative(VAULT, file)} (verified: false)`);
}

if (APPLY) {
  saveSeen();
  logActivity(`emerge --apply: wrote ${wrote} synthesis page(s)`);
  console.log(`\nWrote ${wrote} synthesis page(s). Dedup recorded in ${path.relative(VAULT, SEEN_FILE)}.`);
} else {
  console.log(`\nRe-run with --apply to draft synthesis pages (needs claude CLI + Haiku).`);
}

// ---------------------------------------------------------------------------

// Build clusters keyed by shared tag OR repeated title token. A cluster's key is
// stable across runs (label + sorted member stems) so dedup survives.
function buildClusters(items, min) {
  const byTag = {};
  for (const n of items) {
    for (const t of n.tags) (byTag[`tag:${t}`] = byTag[`tag:${t}`] || []).push(n);
  }
  const byToken = {};
  for (const n of items) {
    const seenTok = new Set();
    for (const w of tokens(n.title)) {
      if (seenTok.has(w)) continue;
      seenTok.add(w);
      (byToken[`token:${w}`] = byToken[`token:${w}`] || []).push(n);
    }
  }
  const raw = { ...groupOf(byTag, min), ...groupOf(byToken, min) };

  // Dedup clusters that cover the same member set (prefer tag-labeled).
  const bySig = new Map();
  for (const [label, members] of Object.entries(raw)) {
    const sig = members.map((m) => m.rel).sort().join("|");
    const prev = bySig.get(sig);
    if (!prev || (label.startsWith("tag:") && !prev.label.startsWith("tag:"))) {
      bySig.set(sig, { label, members });
    }
  }
  return [...bySig.values()].map(({ label, members }) => ({
    label,
    members,
    key: `${label}::${members.map((m) => path.basename(m.rel, ".md")).sort().join(",")}`,
  }));
}

function groupOf(map, min) {
  const out = {};
  for (const [label, members] of Object.entries(map)) {
    if (members.length >= min) out[label] = members;
  }
  return out;
}

function nameCluster(c) {
  const titles = c.members.map((m) => `- ${m.title}`).join("\n");
  const prompt = `These notes share the theme "${c.label.replace(/^(tag|token):/, "")}":
${titles}

Name the underlying pattern in 3-7 words and write a 2-3 sentence synthesis of what connects them and what the meta-lesson is. Return ONLY JSON: {"name":"...","summary":"..."}. No prose, no fences.`;
  const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
    input: prompt, encoding: "utf8", maxBuffer: 12 * 1024 * 1024,
  });
  if (r.status === 0) {
    try {
      let t = r.stdout.trim();
      if (t.startsWith("```")) t = t.replace(/^```(json)?\n/, "").replace(/\n```\s*$/, "");
      const j = JSON.parse(t.match(/\{[\s\S]*\}/)[0]);
      if (j.name) return { name: String(j.name).trim(), summary: String(j.summary || "").trim() };
    } catch {}
  }
  // Fallback: derive a name from the label.
  const base = c.label.replace(/^(tag|token):/, "");
  return { name: `Pattern: ${base}`, summary: `${c.members.length} notes recur around "${base}".` };
}

function writeSynthesis(c, named) {
  fs.mkdirSync(P.insights, { recursive: true });
  let slug = `synthesis-${slugify(named.name)}`;
  let file = path.join(P.insights, `${slug}.md`);
  // Avoid clobbering a different cluster that produced the same name.
  if (fs.existsSync(file)) {
    const suffix = c.label.replace(/^(tag|token):/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    slug = `synthesis-${slugify(named.name)}-${suffix}`;
    file = path.join(P.insights, `${slug}.md`);
  }
  const label = c.label.replace(/^(tag|token):/, "");
  const front = unverifiedFront({
    type: "synthesis",
    date: today(),
    theme: label,
    member_count: c.members.length,
    tags: ["synthesis", "insight"],
  }, MODEL);
  const L = [];
  L.push(fm(front).trimEnd());
  L.push("");
  L.push(`# ${named.name}`);
  L.push("");
  L.push(aiCallout(MODEL).trimEnd());
  L.push("");
  L.push(preambleBlock(`Emergent synthesis across ${c.members.length} notes sharing "${label}". ${named.summary} Unverified — run /sb:verify once reviewed.`).trimEnd());
  L.push("");
  L.push("## Synthesis");
  L.push(named.summary || "(none)");
  L.push("");
  L.push("## Members");
  for (const m of c.members) L.push(`- [[${path.basename(m.rel, ".md")}]] — ${m.title}`);
  L.push("");
  fs.writeFileSync(file, L.join("\n"));
  return file;
}

function loadSeen() { try { return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")); } catch { return {}; } }
function saveSeen() { fs.mkdirSync(path.dirname(SEEN_FILE), { recursive: true }); fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2) + "\n"); }
function today() { return new Date().toISOString().slice(0, 10); }
function flagNum(a, flag, dflt) { const i = a.indexOf(flag); if (i === -1 || i + 1 >= a.length) return dflt; const v = parseInt(a[i + 1], 10); return Number.isFinite(v) ? v : dflt; }
