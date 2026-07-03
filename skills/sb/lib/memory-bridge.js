// memory-bridge.js — bridge between sb and the harness file-memory system.
//
// The harness keeps a durable, cross-session memory at
//   ~/.claude/projects/<sanitized-home>/memory/
// as one-fact-per-file markdown with frontmatter (name/description/type) plus a
// MEMORY.md index (one `- [Title](file.md) — hook` line per fact).
//
// sb promotes durable lessons INTO that memory (promoteFact) and mirrors facts
// back into the Obsidian vault (mirrorToVault) so they are searchable and
// visible in the `memory.base` Obsidian Base. All writes are additive/idempotent
// — we update a fact in place rather than duplicating, and never delete.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { VAULT, DIR, slugify, exists } = require("./vault.js");
const { fm, parseFrontmatter } = require("./markdown.js");
const { preambleBlock } = require("./ai-first.js");

// Default memory dir: mirrors how Claude Code sanitizes the home path
// (/home/prjawal -> -home-prjawal). Override with SB_MEMORY_DIR.
function memoryDir() {
  if (process.env.SB_MEMORY_DIR) return expand(process.env.SB_MEMORY_DIR);
  const home = os.homedir();
  const sanitized = home.replace(/\//g, "-");
  return path.join(home, ".claude", "projects", sanitized, "memory");
}

function expand(p) { return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p; }

const VALID_TYPES = new Set(["user", "feedback", "project", "reference"]);

// Promote a fact into the harness memory. Returns { file, created }.
//   name        kebab-case slug (also the filename)
//   description one-line summary used for recall relevance
//   type        user | feedback | project | reference (default: reference)
//   body        the fact text (markdown)
//   session     originating session id (optional)
//   hook        short index hook for MEMORY.md (defaults to description)
function promoteFact({ name, description, type = "reference", body, session = null, hook = null }) {
  const dir = memoryDir();
  fs.mkdirSync(dir, { recursive: true });
  const slug = slugify(name || description || "fact");
  const t = VALID_TYPES.has(type) ? type : "reference";
  const file = path.join(dir, `${slug}.md`);
  const created = !fs.existsSync(file);
  const desc = String(description || "").replace(/\n/g, " ").trim();

  // The memory schema nests `metadata.type`. `fm()` can't render nested maps, so
  // build the frontmatter block by hand to match the harness format exactly.
  const fmBlock = [
    "---",
    `name: ${slug}`,
    `description: ${jsonSafe(desc)}`,
    "metadata:",
    `  type: ${t}`,
    ...(session ? [`  originSessionId: ${session}`] : []),
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(file, fmBlock + String(body || "").trim() + "\n");
  upsertIndex(dir, slug, hook || desc);
  return { file, created, slug };
}

// Add/refresh the one-line pointer in MEMORY.md. Never duplicates a slug.
function upsertIndex(dir, slug, hook) {
  const idx = path.join(dir, "MEMORY.md");
  let text = fs.existsSync(idx) ? fs.readFileSync(idx, "utf8") : "# Memory Index\n";
  const line = `- [${slug}](${slug}.md) — ${String(hook || "").trim()}`;
  const re = new RegExp(`^- \\[${escapeRe(slug)}\\]\\(${escapeRe(slug)}\\.md\\).*$`, "m");
  if (re.test(text)) text = text.replace(re, line);
  else text = text.replace(/\s*$/, "") + "\n" + line + "\n";
  fs.writeFileSync(idx, text);
}

// List all facts (from the fact files, not just the index). Returns
// [{ slug, description, type, session, body, file }].
function listFacts() {
  const dir = memoryDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "MEMORY.md") continue;
    try {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      out.push({
        slug: meta.name || path.basename(f, ".md"),
        description: meta.description || "",
        type: (meta.metadata && meta.metadata.type) || meta.type || "reference",
        session: (meta.metadata && meta.metadata.originSessionId) || meta.originSessionId || null,
        body: body.trim(),
        file: path.join(dir, f),
      });
    } catch {}
  }
  return out;
}

// Mirror memory facts into the vault (10_Memory/<slug>.md) as AI-first notes so
// they are searchable and appear in the memory.base view. One-directional
// (memory -> vault). Returns the number of notes written.
function mirrorToVault() {
  const facts = listFacts();
  const outDir = path.join(VAULT, DIR.memory);
  fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  const date = new Date().toISOString().slice(0, 10);
  for (const fact of facts) {
    const front = fm({
      type: "memory",
      "memory-type": fact.type,
      slug: fact.slug,
      date,
      description: fact.description,
      source: "memory",
      origin_session: fact.session,
      tags: ["memory", `memory/${fact.type}`],
      "ai-first": true,
    });
    const body = preambleBlock(
      `Harness memory fact (${fact.type}): ${fact.description || fact.slug}. Mirrored from the file-memory store for vault search + Bases.`
    ) + "\n" + fact.body + "\n";
    fs.writeFileSync(path.join(outDir, `${fact.slug}.md`), front + body);
    n++;
  }
  return n;
}

function jsonSafe(s) {
  return /^[\w \-.,/:()']+$/.test(s) ? s : JSON.stringify(s);
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

module.exports = { memoryDir, promoteFact, listFacts, mirrorToVault };
