// Tag-overlap + keyword-similarity link suggester.
// Score = tagOverlap * 1.0 + keywordOverlap * 0.5 + recencyBoost
// recencyBoost = max(0, 0.3 - (ageInDays/365)*0.3)

const fs = require("node:fs");
const path = require("node:path");
const { paths, VAULT, DIR, EXCLUDE_FOLDERS } = require("./vault.js");
const { parseFrontmatter } = require("./markdown.js");

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","have","not","but","you","are","was",
  "were","will","when","what","which","there","their","they","then","than","into","over",
  "should","could","would","about","because","using","while","other","also","more","some",
  "much","very","most","just","like","upon","such","only","need","made","make","than","then",
  "session","conversation","claude","obsidian","vault","project","files","file","code",
]);

function loadAllNotes() {
  const out = [];
  walk(VAULT, (f) => {
    try {
      const text = fs.readFileSync(f, "utf8");
      const { meta, body } = parseFrontmatter(text);
      const rel = path.relative(VAULT, f);
      out.push({
        file: f, rel,
        tags: new Set((meta.tags || []).map((t) => String(t).toLowerCase())),
        keywords: extractKeywords(body),
        mtimeMs: fs.statSync(f).mtimeMs,
        meta,
      });
    } catch {}
  });
  return out;
}

function extractKeywords(text) {
  const words = String(text).toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
  const counts = {};
  for (const w of words) counts[w] = (counts[w] || 0) + 1;
  return new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([w]) => w));
}

function score(target, other) {
  let tagOverlap = 0;
  for (const t of target.tags) if (other.tags.has(t)) tagOverlap++;
  let kwOverlap = 0;
  for (const k of target.keywords) if (other.keywords.has(k)) kwOverlap++;
  const ageDays = (Date.now() - other.mtimeMs) / 86400000;
  const recency = Math.max(0, 0.3 - (ageDays / 365) * 0.3);
  return tagOverlap * 1.0 + kwOverlap * 0.5 + recency;
}

function suggest(targetFile, limit = 5) {
  const notes = loadAllNotes();
  const target = notes.find((n) => path.resolve(n.file) === path.resolve(targetFile));
  if (!target) return [];
  const ranked = notes
    .filter((n) => n.file !== target.file)
    .map((n) => ({ note: n, score: score(target, n), sharedTags: [...target.tags].filter((t) => n.tags.has(t)) }))
    .filter((r) => r.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return ranked;
}

function writeConnection(theme, members, srcFile) {
  const file = path.join(VAULT, DIR.connections, `${theme}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = [
    "---",
    "type: connection",
    `theme: ${theme}`,
    `updated: ${new Date().toISOString()}`,
    "tags: [moc]",
    "---",
    "",
    `# ${theme}`,
    "",
    "## Members",
    "",
    ...[srcFile, ...members].map((m) => `- [[${path.basename(m, ".md")}]]`),
  ];
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name) || e.name === DIR.connections || e.name === "connections") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}

module.exports = { suggest, writeConnection, loadAllNotes };
