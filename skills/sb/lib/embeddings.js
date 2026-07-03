// embeddings.js — key-free semantic layer over smart-connections' precomputed
// vectors. The smart-connections Obsidian plugin embeds every note/block with a
// local model (bge-micro-v2, 384-dim) and writes them to
// <vault>/.smart-env/multi/*.ajson. We read those vectors — no API key, no
// re-embedding — and expose note-to-note similarity plus a keyword-anchor hybrid
// for free-text queries (there is no query-time embedder installed by default).
//
// If SB_EMBED_CMD is set it is used to embed a text query (stdin -> JSON float
// array on stdout); otherwise embedQuery() returns null and callers fall back to
// the lexical-anchor path (anchorVector) or plain keyword search.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { VAULT } = require("./vault.js");

const EMBED_MODEL = process.env.SB_EMBED_MODEL || "TaylorAI/bge-micro-v2";

function smartEnvDir() {
  return path.join(VAULT, ".smart-env", "multi");
}

function hasEmbeddings() {
  const d = smartEnvDir();
  try { return fs.existsSync(d) && fs.readdirSync(d).some((f) => f.endsWith(".ajson")); }
  catch { return false; }
}

// Parse one .ajson append-log file. Duplicate keys are resolved last-wins (the
// file is an append log), which JSON.parse gives us for free.
function parseAjson(file) {
  const raw = fs.readFileSync(file, "utf8").trim().replace(/,\s*$/, "");
  if (!raw) return {};
  try { return JSON.parse("{" + raw + "}"); } catch { return {}; }
}

function pickVec(entry) {
  const embs = entry && entry.embeddings;
  if (!embs) return null;
  const e = embs[EMBED_MODEL] || embs[Object.keys(embs)[0]];
  return e && Array.isArray(e.vec) && e.vec.length ? e.vec : null;
}

// Build { rel: vec } over note-level (smart_sources) vectors.
// rel is the vault-relative note path (e.g. "03_Lessons/x.md").
function loadEmbeddings() {
  const dir = smartEnvDir();
  const index = {};
  if (!fs.existsSync(dir)) return index;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".ajson")) continue;
    let obj;
    try { obj = parseAjson(path.join(dir, f)); } catch { continue; }
    for (const [k, v] of Object.entries(obj)) {
      if (!k.startsWith("smart_sources:")) continue;
      const vec = pickVec(v);
      if (!vec) continue;
      const rel = (v && v.path) || k.slice("smart_sources:".length);
      index[rel] = vec;
    }
  }
  return index;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Nearest neighbours of `vec` within an index. Returns [{ rel, score }] sorted
// desc. excludeRel skips the query note itself.
function nearest(vec, index, { k = 10, excludeRel = null } = {}) {
  if (!vec) return [];
  const out = [];
  for (const [rel, v] of Object.entries(index)) {
    if (excludeRel && rel === excludeRel) continue;
    out.push({ rel, score: cosine(vec, v) });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
}

// Anchor a free-text query to a vector WITHOUT a query embedder: take the top
// lexical hit that also has a precomputed vector, and use its vector. Returns
// { vec, rel } or null. Lazy-requires the retriever to avoid a load cycle.
function anchorVector(query, index) {
  const idx = index || loadEmbeddings();
  const { retrieve } = require("./retriever.js");
  const ranked = retrieve(query, { limit: 20, includeConversations: true });
  for (const r of ranked) {
    if (idx[r.note.rel]) return { vec: idx[r.note.rel], rel: r.note.rel };
  }
  return null;
}

// Optional query embedder via an external command (SB_EMBED_CMD). The command
// receives the query text on stdin and must print a JSON array of floats.
// Returns a number[] or null.
function embedQuery(query) {
  const cmd = process.env.SB_EMBED_CMD;
  if (!cmd) return null;
  const r = spawnSync("sh", ["-c", cmd], { input: String(query || ""), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) return null;
  try {
    const v = JSON.parse(r.stdout.trim());
    return Array.isArray(v) && v.length ? v : null;
  } catch { return null; }
}

module.exports = {
  EMBED_MODEL, smartEnvDir, hasEmbeddings,
  loadEmbeddings, cosine, nearest, anchorVector, embedQuery,
};
