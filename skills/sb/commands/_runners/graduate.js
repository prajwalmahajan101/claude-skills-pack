#!/usr/bin/env node
// graduate.js — promote a captured idea into a real project.
// Usage: graduate.js <idea-slug-or-path> [--project <slug>]
//
// Ensures 02_Projects/<slug>/ exists (INDEX + kanban), seeds the kanban board
// with one card per bullet in the idea's "## Idea" section (backlinked to the
// idea note), then flips the idea to status: graduated and adds a backlink to the
// new project. Idempotent-ish: re-graduating an already-graduated idea is refused.

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, DIR, paths, ensureDirs, slugify } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter, fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { addTask } = require(path.join(SKILL_LIB, "kanban.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const opts = parseFlags(process.argv.slice(2));
const arg = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
if (!arg) { console.error("Usage: graduate.js <idea-slug-or-path> [--project <slug>]"); process.exit(2); }

const ideaFile = resolveIdea(arg);
if (!ideaFile) { console.error(`No idea found matching "${arg}" in ${DIR.ideas}/.`); process.exit(1); }

const raw = fs.readFileSync(ideaFile, "utf8");
const { meta, body } = parseFrontmatter(raw);
if (meta.status === "graduated") { console.error(`Idea already graduated (to ${meta.graduated_to || "?"}).`); process.exit(1); }

const ideaStem = path.basename(ideaFile, ".md");
const title = firstHeading(body) || meta.title || ideaStem;
const slug = opts.project ? slugify(opts.project) : slugify(title);
const p = ensureDirs(slug);

// Seed project INDEX if the project is brand new.
const created = !fs.existsSync(p.projectIndex);
if (created) fs.writeFileSync(p.projectIndex, projectIndexTemplate(slug, ideaStem, title));

// Seed kanban cards from the idea's bullets.
const bullets = extractBullets(body);
for (const b of bullets) addTask(p.projectKanban, slug, b, { noteLink: ideaStem });

// Flip the idea to graduated + backlink.
const newFront = { ...meta, status: "graduated", graduated_to: slug, graduated_at: today() };
const backlink = `\n\n## Graduated\nGraduated to project [[${slug} INDEX|${slug}]] on ${today()}.\n`;
const newBody = /##\s+Graduated\b/.test(body) ? body : body.replace(/\s*$/, "") + backlink + "\n";
fs.writeFileSync(ideaFile, fm(newFront) + newBody);

console.log(`Graduated idea "${title}" -> project ${slug}${created ? " (new)" : " (existing)"}.`);
console.log(`  Project: ${path.relative(VAULT, p.projectIndex)}`);
console.log(`  Seeded ${bullets.length} kanban card(s) from idea bullets.`);
console.log(`  Idea marked status: graduated (backlinked).`);
logActivity(`graduate: ${title} -> ${slug} (${bullets.length} cards)`);

// ---------------------------------------------------------------------------

function resolveIdea(a) {
  const direct = path.isAbsolute(a) ? a : path.join(paths("_").ideas, a);
  for (const cand of [a, direct, direct.endsWith(".md") ? direct : direct + ".md"]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  const dir = paths("_").ideas;
  if (!fs.existsSync(dir)) return null;
  const needle = a.toLowerCase().replace(/\.md$/, "");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const hit = files.find((f) => path.basename(f, ".md").toLowerCase() === needle)
    || files.find((f) => f.toLowerCase().includes(needle));
  return hit ? path.join(dir, hit) : null;
}

function extractBullets(body) {
  // Bullets under the "## Idea" section (fall back to any top-level bullets),
  // excluding the "## For future Claude" preamble.
  const lines = body.split("\n");
  const out = [];
  let inIdea = false;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { inIdea = /^idea\b/i.test(h[1].trim()); continue; }
    if (inIdea) {
      const m = line.match(/^\s*[-*]\s+(.+)$/);
      if (m) out.push(m[1].trim());
    }
  }
  if (out.length) return out;
  // Fallback: any bullet in the body except within the preamble.
  let inPreamble = false;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { inPreamble = /future claude/i.test(h[1]); continue; }
    if (inPreamble) continue;
    const m = line.match(/^\s*[-*]\s+(.+)$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function firstHeading(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function projectIndexTemplate(slug, ideaStem, title) {
  return `---
type: project-index
project: ${slug}
status: active
created: ${new Date().toISOString()}
graduated_from: ${ideaStem}
tags: [project]
---

# ${title}

> Graduated from idea [[${ideaStem}]] on ${today()}. Edit freely; new sessions append to the linked sections.

## Kanban
[[kanban]]

## Lessons (project-scoped)
[[lessons]]

## Plans
\`\`\`
ls plans/
\`\`\`
`;
}

function today() { return new Date().toISOString().slice(0, 10); }

function parseFlags(arr) {
  const out = { _: [] };
  const val = new Set(["project"]);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) { const k = a.slice(2); if (val.has(k)) out[k] = arr[++i]; else out[k] = true; }
    else out._.push(a);
  }
  return out;
}
