#!/usr/bin/env node
// health.js — deterministic, read-only audit of the sb vault.
// Usage: health.js [--json]
//
// Ports obsidian-second-brain's scripts/vault_health.py to JS (sb is JS-only).
// Detects: orphan notes (no incoming wikilinks), duplicate notes (near-identical
// titles), stale task notes (past due), notes missing frontmatter, frontmatter
// trapped in a leading ```code fence (unwrap, don't prepend), empty folders, and
// unfilled <%templater%> leftovers. Pure audit — surfaces issues, fixes nothing.

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, EXCLUDE_FOLDERS } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const asJson = process.argv.includes("--json");
const TODAY = new Date().toISOString().slice(0, 10);
const LINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
const TEMPLATE_RE = /<%[\s\S]*?%>/;
const CODE_FENCE_WRAP_RE = /^\s*```[^\n]*\n\s*---\s*\n/;

const notes = loadVault();
const report = audit(notes);

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

function loadVault() {
  const out = {};
  walk(VAULT, (file) => {
    if (!file.endsWith(".md")) return;
    const rel = path.relative(VAULT, file);
    const parts = rel.split(path.sep);
    if (parts.some((p) => EXCLUDE_FOLDERS.includes(p) || /templates$/i.test(p) || p.startsWith("."))) return;
    let content = "";
    try { content = fs.readFileSync(file, "utf8"); } catch { return; }
    const hasFm = content.startsWith("---\n");
    const { meta } = hasFm ? parseFrontmatter(content) : { meta: {} };
    const links = [];
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(content))) links.push(m[1].trim().replace(/\\$/, ""));
    out[rel] = {
      rel, file,
      stem: path.basename(file, ".md"),
      folder: parts[0],
      hasFrontmatter: hasFm,
      codeFenceWrapped: !hasFm && CODE_FENCE_WRAP_RE.test(content),
      type: meta.type || null,
      status: meta.status || null,
      due: meta.due || null,
      links,
      hasTemplateLeftover: TEMPLATE_RE.test(content),
      size: content.length,
    };
  });
  return out;
}

function audit(notes) {
  const values = Object.values(notes);
  const stems = new Set(values.map((n) => n.stem.toLowerCase()));

  // Incoming-link count per stem.
  const incoming = {};
  for (const n of values) {
    for (const l of n.links) {
      const target = path.basename(l).toLowerCase();
      incoming[target] = (incoming[target] || 0) + 1;
    }
  }

  // Orphans that matter: lessons/topics nothing links to. Project scaffolding
  // (INDEX/kanban/lessons/plans), conversations, inbox, exports and memory are
  // reachable structurally (folder/listing), so they are not "orphans".
  const orphans = values
    .filter((n) => ["lessons", "topics"].includes(folderType(n)))
    .filter((n) => (incoming[n.stem.toLowerCase()] || 0) === 0)
    .map((n) => n.rel);

  // Duplicates: group by normalized title, report groups with >1 member.
  const byNorm = {};
  for (const n of values) {
    const key = n.stem.toLowerCase().replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/[^a-z0-9]+/g, "");
    (byNorm[key] = byNorm[key] || []).push(n.rel);
  }
  const duplicates = Object.values(byNorm).filter((g) => g.length > 1);

  const staleTasks = values
    .filter((n) => n.type === "task" && n.status !== "done" && n.due && n.due < TODAY)
    .map((n) => ({ rel: n.rel, due: n.due }));

  const missingFrontmatter = values.filter((n) => !n.hasFrontmatter && !n.codeFenceWrapped).map((n) => n.rel);
  const codeFenceWrapped = values.filter((n) => n.codeFenceWrapped).map((n) => n.rel);
  const templateLeftovers = values.filter((n) => n.hasTemplateLeftover).map((n) => n.rel);
  const emptyFolders = findEmptyFolders(VAULT);

  return {
    scanned: values.length,
    orphans, duplicates, staleTasks,
    missingFrontmatter, codeFenceWrapped, templateLeftovers, emptyFolders,
  };
}

function folderType(n) {
  return n.folder.replace(/^\d+_/, "").toLowerCase();
}

function findEmptyFolders(root) {
  const empty = [];
  (function rec(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return true; }
    const kids = entries.filter((e) => !e.name.startsWith(".") && !EXCLUDE_FOLDERS.includes(e.name));
    let hasFile = false;
    for (const e of kids) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { const childEmpty = rec(full); if (!childEmpty) hasFile = true; }
      else hasFile = true;
    }
    if (!hasFile && dir !== root) empty.push(path.relative(root, dir));
    return !hasFile;
  })(root);
  return empty;
}

function walk(dir, fn) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else fn(full);
  }
}

function printReport(r) {
  const L = [];
  L.push(`sb vault health — ${r.scanned} notes scanned`);
  L.push("");
  section(L, "Orphan notes (no incoming links)", r.orphans);
  section(L, "Duplicate note clusters", r.duplicates.map((g) => g.join("  ==  ")));
  section(L, "Stale tasks (past due, not done)", r.staleTasks.map((t) => `${t.rel}  (due ${t.due})`));
  section(L, "Missing frontmatter", r.missingFrontmatter);
  section(L, "Frontmatter trapped in code fence (UNWRAP — do not add)", r.codeFenceWrapped);
  section(L, "Unfilled <%templater%> leftovers", r.templateLeftovers);
  section(L, "Empty folders", r.emptyFolders);

  const issues = r.orphans.length + r.duplicates.length + r.staleTasks.length +
    r.missingFrontmatter.length + r.codeFenceWrapped.length + r.templateLeftovers.length + r.emptyFolders.length;
  L.push("");
  L.push(issues === 0 ? "Clean — no issues found." : `${issues} issue group(s). Run /sb:consolidate to merge duplicates + archive stale.`);
  console.log(L.join("\n"));
}

function section(L, title, items) {
  L.push(`### ${title}: ${items.length}`);
  for (const it of items.slice(0, 25)) L.push(`  - ${it}`);
  if (items.length > 25) L.push(`  … +${items.length - 25} more`);
  L.push("");
}
