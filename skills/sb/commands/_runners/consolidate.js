#!/usr/bin/env node
// consolidate.js — bound vault growth: dedupe lessons, flag stale conversations
// and orphans, promote durable lessons into harness memory, and (optionally)
// merge/archive. Usage: consolidate.js [--apply]
//
// DEFAULT is a dry-run: it writes a report to 99_Inbox/consolidate-<date>.md and
// changes nothing else. `--apply` performs the safe mutations (merge duplicate
// lessons into the newest, move stale convos to an _archive/ folder — never a
// hard delete). Deterministic clustering; no LLM required.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, DIR, paths, readSessionMap } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { promoteFact, mirrorToVault } = require(path.join(SKILL_LIB, "memory-bridge.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));
const { importToVault } = require(path.join(SKILL_LIB, "lessons-bridge.js"));

const APPLY = process.argv.includes("--apply");
const PROMOTE = process.env.SB_MEMORY_PROMOTE !== "0";
const STALE_DAYS = parseInt(process.env.SB_CONSOLIDATE_STALE_DAYS || "90", 10);
const P = paths("_");
const DATE = new Date().toISOString().slice(0, 10);

const lessons = loadLessons();
const clusters = clusterDuplicates(lessons);
const orphans = findOrphans(lessons);
const staleConvos = findStaleConvos();
const durable = lessons.filter((l) => isDurable(l));

const actions = [];

// --- Promote durable lessons into harness memory (additive, idempotent) ---
let promoted = 0;
if (PROMOTE) {
  for (const l of durable) {
    if (APPLY) {
      promoteFact({
        name: l.stem.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
        description: l.title || l.stem,
        type: "reference",
        body: `${l.summary || l.title}\n\nSource lesson: [[${l.stem}]] (sb vault ${DIR.lessons}).`,
        hook: l.title || l.stem,
      });
    }
    promoted++;
  }
  if (APPLY) mirrorToVault();
}

// Converge the global ~/.claude/lessons store into the vault so all three lesson
// stores (global, vault, memory) stay in sync.
let lessonsImported = 0;
if (APPLY) {
  try { lessonsImported = importToVault(); } catch {}
}

// --- Merge duplicate clusters into the newest member ---
let merged = 0;
for (const group of clusters) {
  const sorted = group.slice().sort((a, b) => b.stem.localeCompare(a.stem));
  const keep = sorted[0];
  const drop = sorted.slice(1);
  actions.push(`MERGE ${drop.map((d) => d.stem).join(", ")} -> ${keep.stem}`);
  if (APPLY) {
    let merge = "\n\n## Merged from\n";
    for (const d of drop) {
      merge += `\n### ${d.stem} (${d.date || "?"})\n${d.summary || ""}\n`;
    }
    fs.appendFileSync(keep.file, merge);
    for (const d of drop) archiveFile(d.file, P.lessons);
    merged += drop.length;
  }
}

// --- Archive stale conversations ---
let archived = 0;
for (const c of staleConvos) {
  actions.push(`ARCHIVE stale convo ${path.relative(VAULT, c.file)} (last ${c.last})`);
  if (APPLY) { archiveFile(c.file, path.dirname(c.file)); archived++; }
}

// --- Write the report ---
const report = buildReport();
fs.mkdirSync(P.inbox, { recursive: true });
const reportFile = path.join(P.inbox, `consolidate-${DATE}.md`);
fs.writeFileSync(reportFile, report);

// --- Regenerate Bases, entry docs, emergent synthesis + log (only on apply) ---
if (APPLY) {
  // bases + dashboard + init take no args; emerge needs --apply to write.
  const runners = [
    ["bases.js", []],
    ["dashboard.js", []],
    ["init.js", []],
    ["emerge.js", ["--apply"]],
  ];
  for (const [runner, extraArgs] of runners) {
    try {
      require("node:child_process").execFileSync(
        process.execPath,
        [path.join(SKILL_LIB, "..", "commands", "_runners", runner), ...extraArgs],
        { stdio: "ignore" }
      );
    } catch {}
  }
  logActivity(
    `consolidate --apply: merged ${merged} lesson dup(s), archived ${archived} convo(s), promoted ${promoted} fact(s) to memory, imported ${lessonsImported} global lesson(s).`
  );
}

console.log(`${APPLY ? "Applied" : "Dry-run"} consolidation. Report: ${path.relative(VAULT, reportFile)}`);
console.log(`  duplicate clusters: ${clusters.length}  |  stale convos: ${staleConvos.length}  |  orphans: ${orphans.length}  |  durable->memory: ${promoted}`);
if (!APPLY && (clusters.length || staleConvos.length || durable.length)) {
  console.log("  Re-run with --apply to merge duplicates, archive stale convos, and promote facts.");
}

// ---------------------------------------------------------------------------

function loadLessons() {
  const dir = P.lessons;
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const file = path.join(dir, f);
    let raw = "";
    try { raw = fs.readFileSync(file, "utf8"); } catch { continue; }
    const { meta, body } = parseFrontmatter(raw);
    const titleMatch = body.match(/^#\s+(.+)$/m);
    out.push({
      file, stem: path.basename(f, ".md"),
      title: titleMatch ? titleMatch[1].trim() : path.basename(f, ".md"),
      date: meta.date || null,
      tags: coerceTags(meta.tags),
      summary: firstPara(body),
      size: raw.length,
    });
  }
  return out;
}

// Frontmatter tags may parse as an array (block style) or a raw string
// ("[a, b]" inline). Coerce to a clean string[] either way.
function coerceTags(t) {
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === "string") {
    return t.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function firstPara(body) {
  const lines = body.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => l && !l.startsWith("#") && !l.startsWith("##"));
  if (start === -1) return "";
  const out = [];
  for (let i = start; i < lines.length && lines[i]; i++) out.push(lines[i]);
  return out.join(" ").slice(0, 400);
}

function normTitle(s) {
  return s.toLowerCase().replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// Cluster lessons whose normalized titles are identical or within a small token
// overlap threshold. Returns arrays of length >= 2.
function clusterDuplicates(items) {
  const seen = new Set();
  const clusters = [];
  for (let i = 0; i < items.length; i++) {
    if (seen.has(i)) continue;
    const group = [items[i]];
    const ti = new Set(normTitle(items[i].title).split(" ").filter(Boolean));
    for (let j = i + 1; j < items.length; j++) {
      if (seen.has(j)) continue;
      const tj = new Set(normTitle(items[j].title).split(" ").filter(Boolean));
      if (jaccard(ti, tj) >= 0.7) { group.push(items[j]); seen.add(j); }
    }
    if (group.length > 1) { seen.add(i); clusters.push(group); }
  }
  return clusters;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function findOrphans(items) {
  // Build incoming-link set across the whole vault.
  const incoming = new Set();
  walk(VAULT, (file) => {
    if (!file.endsWith(".md")) return;
    let raw = "";
    try { raw = fs.readFileSync(file, "utf8"); } catch { return; }
    const re = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
    let m;
    while ((m = re.exec(raw))) incoming.add(path.basename(m[1].trim()).toLowerCase());
  });
  return items.filter((l) => !incoming.has(l.stem.toLowerCase()));
}

function findStaleConvos() {
  const map = readSessionMap();
  const cutoff = Date.now() - STALE_DAYS * 86400000;
  const out = [];
  for (const entry of Object.values(map)) {
    if (!entry.file || !fs.existsSync(entry.file)) continue;
    if (entry.file.includes(`${path.sep}_archive${path.sep}`)) continue;
    let analyzed = false, last = entry.lastWriteAt || null;
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(entry.file, "utf8"));
      analyzed = meta.analyzed === true;
      last = meta.last_updated || last;
    } catch {}
    if (!analyzed) continue;
    const t = last ? new Date(last).getTime() : 0;
    if (t && t < cutoff) out.push({ file: entry.file, last: (last || "").slice(0, 10) });
  }
  return out;
}

// A lesson is "durable" (worth promoting to cross-session memory) if it carries a
// reusable-scope tag or is not tied to a single ephemeral project detail.
function isDurable(l) {
  const tags = l.tags.map((t) => t.toLowerCase());
  return tags.some((t) => /(pattern|principle|gotcha|convention|reference|architecture|decision)/.test(t));
}

function archiveFile(file, baseDir) {
  const archiveDir = path.join(baseDir, "_archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  const dest = path.join(archiveDir, path.basename(file));
  fs.renameSync(file, dest);
}

function buildReport() {
  const L = [];
  L.push("---");
  L.push("type: consolidation-report");
  L.push(`date: ${DATE}`);
  L.push(`mode: ${APPLY ? "apply" : "dry-run"}`);
  L.push("tags: [inbox, consolidation]");
  L.push("ai-first: true");
  L.push("---");
  L.push("");
  L.push("## For future Claude");
  L.push(`Consolidation ${APPLY ? "applied" : "dry-run"} on ${DATE}. Lists duplicate lesson`);
  L.push("clusters, stale conversations, orphan lessons, and lessons promoted to harness memory.");
  L.push("");
  L.push(`# Consolidation report — ${DATE} (${APPLY ? "APPLIED" : "dry-run"})`);
  L.push("");
  L.push(`## Duplicate lesson clusters: ${clusters.length}`);
  for (const g of clusters) {
    const sorted = g.slice().sort((a, b) => b.stem.localeCompare(a.stem));
    L.push(`- keep **${sorted[0].stem}**, merge: ${sorted.slice(1).map((d) => d.stem).join(", ")}`);
  }
  L.push("");
  L.push(`## Stale conversations (> ${STALE_DAYS}d, analyzed): ${staleConvos.length}`);
  for (const c of staleConvos) L.push(`- ${path.relative(VAULT, c.file)} (last ${c.last})`);
  L.push("");
  L.push(`## Orphan lessons (no incoming links): ${orphans.length}`);
  for (const o of orphans.slice(0, 40)) L.push(`- [[${o.stem}]]`);
  L.push("");
  L.push(`## Durable lessons promoted to memory: ${durable.length}${PROMOTE ? "" : " (promotion disabled)"}`);
  for (const d of durable) L.push(`- ${d.stem} — ${d.title}`);
  L.push("");
  if (!APPLY) {
    L.push("> Dry-run: nothing was moved, merged, or deleted. Re-run `/sb:consolidate --apply` to act.");
  } else {
    L.push("### Actions applied");
    for (const a of actions) L.push(`- ${a}`);
  }
  L.push("");
  return L.join("\n");
}

function walk(dir, fn) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".") || ["_templates", "_assets", "_meta", "__scribble"].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else fn(full);
  }
}
