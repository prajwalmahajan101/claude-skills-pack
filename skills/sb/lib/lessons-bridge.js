// lessons-bridge.js — bridge between sb and the global ~/.claude/lessons store.
//
// The `lessons` skill keeps a curated, cross-project lesson library at
// ~/.claude/lessons/ (one file per lesson: `YYYY-MM-DD-<slug>.md` with a
// date/tags/context frontmatter + `## Decision` body) plus a hand-maintained
// INDEX.md. The user's CLAUDE.md treats this store as canonical. sb imports these
// into the vault (03_Lessons) as AI-first notes so search/Bases/consolidate see
// them, and can optionally push a pointer back to the global INDEX.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { VAULT, DIR, slugify } = require("./vault.js");
const { fm, parseFrontmatter } = require("./markdown.js");
const { preambleBlock } = require("./ai-first.js");

function lessonsDir() {
  if (process.env.SB_LESSONS_DIR) return expand(process.env.SB_LESSONS_DIR);
  return path.join(os.homedir(), ".claude", "lessons");
}
function expand(p) { return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p; }

// List global lessons (files, not just the index). Returns
// [{ slug, date, tags, context, body, file }].
function listGlobalLessons() {
  const dir = lessonsDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "INDEX.md") continue;
    try {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      out.push({
        slug: path.basename(f, ".md"),
        date: meta.date || null,
        tags: coerceTags(meta.tags),
        context: meta.context || "",
        body: body.trim(),
        file: path.join(dir, f),
      });
    } catch {}
  }
  return out;
}

// Import global lessons into the vault (03_Lessons) as AI-first notes. Idempotent
// by slug (overwrites the mirror). Returns the count written.
function importToVault() {
  const lessons = listGlobalLessons();
  const outDir = path.join(VAULT, DIR.lessons);
  fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const l of lessons) {
    const front = fm({
      type: "lesson",
      date: l.date || new Date().toISOString().slice(0, 10),
      source: "global-lessons",
      tags: dedupeTags(["lesson", ...l.tags]),
      "ai-first": true,
    });
    const summary = l.context || `Imported lesson: ${l.slug}`;
    const body = `# ${titleize(l.slug)}\n\n${preambleBlock(summary)}\n${l.body}\n\n## Source\nGlobal lessons store: \`~/.claude/lessons/${l.slug}.md\`\n`;
    fs.writeFileSync(path.join(outDir, `${l.slug}.md`), front + body);
    n++;
  }
  return n;
}

// Push a one-line pointer to the global INDEX.md (opt-in). Never duplicates a slug.
// Returns true if the index was modified.
function pushPointer(slug, hook) {
  const idx = path.join(lessonsDir(), "INDEX.md");
  if (!fs.existsSync(idx)) return false;
  let text = fs.readFileSync(idx, "utf8");
  const line = `- \`${slug}.md\` — ${String(hook || "").trim()}`;
  if (text.includes(`\`${slug}.md\``)) return false; // already indexed
  text = text.replace(/\s*$/, "") + "\n" + line + "\n";
  fs.writeFileSync(idx, text);
  return true;
}

function coerceTags(t) {
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === "string") return t.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
function dedupeTags(arr) { return [...new Set(arr.map(String))]; }
function titleize(slug) {
  return slug.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { lessonsDir, listGlobalLessons, importToVault, pushPointer };
