// Two-layer tagger: rules (keyword → tag) + LLM-suggested tags merged together.
// Hardened (Phase 8a.2): length floor (≥3 chars after #), regex guard, alias resolution.

const fs = require("node:fs");
const path = require("node:path");
const { paths, readJSON, EXCLUDE_FOLDERS } = require("./vault.js");
const { parseFrontmatter, fm } = require("./markdown.js");
const { loadAliases, resolveAlias } = require("./tag-aliases.js");

const TAG_RE = /^#[a-z][a-z0-9/_-]{1,}$/;  // ≥2 chars after #: allows #ai, #js, #go; still kills #n, #a, #[

function loadRules() {
  return readJSON(paths("_").tagRules, {});
}

function applyRules(text, rules) {
  const aliases = loadAliases();
  const out = new Set();
  const haystack = String(text).toLowerCase();
  for (const [pattern, tag] of Object.entries(rules || {})) {
    try {
      const re = new RegExp(`\\b(${pattern})\\b`, "i");
      if (re.test(haystack)) {
        const n = normTag(tag, aliases);
        if (n) out.add(n);
      }
    } catch {
      if (haystack.includes(pattern.toLowerCase())) {
        const n = normTag(tag, aliases);
        if (n) out.add(n);
      }
    }
  }
  return [...out];
}

function normTag(t, aliases = null) {
  if (t === null || t === undefined) return null;
  let s = String(t).trim();
  if (!s) return null;
  // Strip surrounding brackets/quotes/punctuation that LLMs sometimes emit.
  s = s.replace(/^["'`\[\(\{]+|["'`\]\)\}]+$/g, "").trim();
  if (!s) return null;
  if (!s.startsWith("#")) s = "#" + s;
  s = s.toLowerCase().replace(/\s+/g, "-");
  // Apply alias resolution
  s = resolveAlias(s, aliases);
  // Validate shape: # + letter + ≥2 more chars from [a-z0-9/_-]
  if (!TAG_RE.test(s)) return null;
  return s;
}

function mergeTags(...lists) {
  const aliases = loadAliases();
  const set = new Set();
  for (const l of lists) {
    for (const t of l || []) {
      const norm = normTag(t, aliases);
      if (norm) set.add(norm);
    }
  }
  return [...set].sort();
}

function tagFile(file, llmSuggested = []) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf8");
  const { meta, body } = parseFrontmatter(content);
  const rules = loadRules();
  const ruleTags = applyRules(body + " " + (meta.title || ""), rules);
  const merged = mergeTags(meta.tags || [], ruleTags, llmSuggested);
  if (sameSet(merged, meta.tags || [])) return merged;
  meta.tags = merged;
  fs.writeFileSync(file, fm(meta) + body);
  return merged;
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

function rebuildTagsIndex() {
  const root = paths("_").vault;
  const tagsFile = paths("_").tagsIndex;
  const counts = {};
  walkMd(root, (f) => {
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(f, "utf8"));
      for (const t of meta.tags || []) {
        const key = normTag(t);
        counts[key] = (counts[key] || 0) + 1;
      }
    } catch {}
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const lines = [
    "---", "type: tag-index", `updated: ${new Date().toISOString()}`, "---", "",
    "# Tags", "",
    ...sorted.map(([t, n]) => `- ${t} — ${n}`),
  ];
  fs.writeFileSync(tagsFile, lines.join("\n") + "\n");
  return counts;
}

function walkMd(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}

module.exports = { loadRules, applyRules, normTag, mergeTags, tagFile, rebuildTagsIndex };
