// Lexical retrieval over vault notes. Used by /sb:ask and /sb:recall.
// No embeddings — pure tag overlap + TF-style keyword scoring + recency.

const fs = require("node:fs");
const path = require("node:path");
const { VAULT, paths, EXCLUDE_FOLDERS, folderToType } = require("./vault.js");
const { parseFrontmatter } = require("./markdown.js");

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","have","not","but","you","are","was",
  "were","will","when","what","which","there","their","they","then","than","into","over",
  "should","could","would","about","because","using","while","other","also","more","some",
  "much","very","most","just","like","upon","such","only","need","made","make","than","then",
  "session","conversation","claude","vault","project","files","file","code","just","want","know",
  "right","wrong","good","bad","very","really","actually","probably","maybe","seems","seems",
]);

function tokens(text) {
  return String(text || "").toLowerCase()
    .replace(/[^a-z0-9_/#-]+/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function loadIndex({ excludeFolders = EXCLUDE_FOLDERS } = {}) {
  const notes = [];
  walk(VAULT, excludeFolders, (f) => {
    try {
      const text = fs.readFileSync(f, "utf8");
      const { meta, body } = parseFrontmatter(text);
      const ws = tokens(body);
      const counts = {};
      for (const w of ws) counts[w] = (counts[w] || 0) + 1;
      notes.push({
        file: f,
        rel: path.relative(VAULT, f),
        type: meta.type || inferType(f),
        tags: coerceTags(meta.tags),
        title: meta.title || path.basename(f, ".md"),
        body,
        keywords: counts,
        mtimeMs: fs.statSync(f).mtimeMs,
        meta,
      });
    } catch {}
  });
  return notes;
}

// Frontmatter tags may parse as a real array (block style) or a raw string
// ("[a, b]" inline). Coerce to a clean lowercased string[] either way so a note
// is never silently dropped from the index over a `.map` on a string.
function coerceTags(t) {
  if (Array.isArray(t)) return t.map((x) => String(x).toLowerCase());
  if (typeof t === "string") {
    return t.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function inferType(file) {
  const rel = path.relative(VAULT, file);
  return folderToType(rel.split("/")[0]);
}

function scoreNote(note, queryTokens, queryTags, { recencyBoost = 0.2 } = {}) {
  let kw = 0;
  for (const t of queryTokens) if (note.keywords[t]) kw += Math.log(1 + note.keywords[t]);
  let tagOverlap = 0;
  for (const t of queryTags) if (note.tags.includes(t)) tagOverlap++;
  const ageDays = (Date.now() - note.mtimeMs) / 86400000;
  const rec = Math.max(0, recencyBoost - (ageDays / 365) * recencyBoost);
  // Lessons and topics are higher signal than raw conversations
  const typeBoost = note.type === "lessons" ? 0.5 : note.type === "topics" ? 0.4 : note.type === "connections" ? 0.3 : 0;
  return kw + tagOverlap * 1.5 + rec + typeBoost;
}

function retrieve(query, { limit = 10, includeConversations = true, queryTags = [] } = {}) {
  const queryToks = tokens(query);
  const notes = loadIndex();
  const ranked = notes
    .filter(n => includeConversations || n.type !== "conversations")
    .map(n => ({ note: n, score: scoreNote(n, queryToks, queryTags) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return ranked;
}

function noteSnippet(note, queryToks, maxLen = 400) {
  const lines = note.body.split("\n").filter(l => l.trim());
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (queryToks.some(t => lower.includes(t))) {
      return line.length > maxLen ? line.slice(0, maxLen - 1) + "…" : line;
    }
  }
  return lines.slice(0, 3).join(" ").slice(0, maxLen);
}

function walk(dir, exclude, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || exclude.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, exclude, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}

module.exports = { retrieve, tokens, loadIndex, scoreNote, noteSnippet };
