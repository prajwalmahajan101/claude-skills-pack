#!/usr/bin/env node
// related.js — semantically nearest notes to a given note, using precomputed
// smart-connections vectors (key-free). Usage: related.js <note-path-or-slug> [--k N]
//
// Pure note-to-note cosine over <vault>/.smart-env/multi/*.ajson — no query
// embedder, no API key. If the note has no precomputed vector (too new / not yet
// embedded by smart-connections), falls back to the lexical retriever.

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { loadEmbeddings, nearest, hasEmbeddings } = require(path.join(SKILL_LIB, "embeddings.js"));
const { loadIndex, retrieve } = require(path.join(SKILL_LIB, "retriever.js"));

const args = process.argv.slice(2);
const K = flagNum(args, "--k", 10);
const arg = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a)).join(" ").replace(/^["']|["']$/g, "").trim()
  || args.filter((a) => !a.startsWith("--")).join(" ").replace(/^["']|["']$/g, "").trim();
if (!arg) { console.error("Usage: related.js <note-path-or-slug> [--k N]"); process.exit(2); }

const rel = resolveRel(arg);
if (!rel) { console.error(`No note found matching "${arg}".`); process.exit(1); }

if (!hasEmbeddings()) {
  console.log("No smart-connections vectors found (.smart-env/multi absent). Falling back to lexical.");
  lexicalFallback(rel);
  process.exit(0);
}

const index = loadEmbeddings();
const vec = index[rel];
if (!vec) {
  console.log(`"${rel}" has no precomputed vector yet (open it in Obsidian so smart-connections embeds it). Falling back to lexical.`);
  lexicalFallback(rel);
  process.exit(0);
}

const hits = nearest(vec, index, { k: K, excludeRel: rel });
console.log(`Semantically nearest to ${rel} (precomputed bge-micro-v2, note-to-note):\n`);
for (const h of hits) console.log(`  ${h.score.toFixed(3)}  ${h.rel}`);
if (!hits.length) console.log("  (no neighbours)");

// ---------------------------------------------------------------------------

function resolveRel(a) {
  const asPath = path.isAbsolute(a) ? a : path.join(VAULT, a);
  for (const cand of [asPath, asPath.endsWith(".md") ? asPath : asPath + ".md"]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return path.relative(VAULT, cand);
  }
  const needle = a.toLowerCase().replace(/\.md$/, "");
  const notes = loadIndex();
  const hit = notes.find((n) => path.basename(n.rel, ".md").toLowerCase() === needle)
    || notes.find((n) => (n.title || "").toLowerCase() === needle)
    || notes.find((n) => n.rel.toLowerCase().includes(needle));
  return hit ? hit.rel : null;
}

function lexicalFallback(rel) {
  const notes = loadIndex();
  const self = notes.find((n) => n.rel === rel);
  if (!self) { console.log("  (source note not indexed)"); return; }
  const q = (self.title || "") + " " + self.body.slice(0, 500);
  const ranked = retrieve(q, { limit: K + 1, includeConversations: true }).filter((r) => r.note.rel !== rel).slice(0, K);
  for (const r of ranked) console.log(`  ${r.score.toFixed(2)}  ${r.note.rel}`);
  if (!ranked.length) console.log("  (no lexical neighbours)");
}

function flagNum(argv, flag, dflt) {
  const i = argv.indexOf(flag);
  if (i === -1 || i + 1 >= argv.length) return dflt;
  const v = parseInt(argv[i + 1], 10);
  return Number.isFinite(v) ? v : dflt;
}
