#!/usr/bin/env node
// idea.js — capture an idea into 16_Ideas/ (type: idea, status: captured).
// Usage: idea.js "<title>" [--body "..."] [--tags a,b] [--project <slug>]
//
// Ideas are lightweight seeds. List bullet points in --body (newline or "; "
// separated) and they become the graduation checklist -> /sb:graduate seeds them
// as kanban cards on the new project board.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, paths, slugify } = require(path.join(SKILL_LIB, "vault.js"));
const { fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock, aiFirstFront } = require(path.join(SKILL_LIB, "ai-first.js"));
const { tagFile } = require(path.join(SKILL_LIB, "tagger.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const opts = parseFlags(process.argv.slice(2));
const title = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
if (!title) { console.error('Usage: idea.js "<title>" [--body "..."] [--tags a,b]'); process.exit(2); }

const P = paths("_");
fs.mkdirSync(P.ideas, { recursive: true });
const slug = slugify(title);
const file = path.join(P.ideas, `${slug}.md`);
if (fs.existsSync(file)) { console.error(`Idea already exists: ${path.relative(VAULT, file)}`); process.exit(1); }

const date = new Date().toISOString().slice(0, 10);
const tags = ["idea", ...(opts.tags ? opts.tags.split(",").map((t) => t.trim()).filter(Boolean) : [])];
const front = aiFirstFront({
  type: "idea",
  date,
  status: "captured",
  project: opts.project || "",
  tags,
});

const bullets = splitBullets(opts.body);
const body =
  `# ${title}\n\n` +
  preambleBlock(`Captured idea: ${title}. Status: captured. Graduate with /sb:graduate to spin up a project and seed its kanban from the bullets below.`) +
  "\n## Idea\n" +
  (bullets.length ? bullets.map((b) => `- ${b}`).join("\n") + "\n" : (opts.body ? `${opts.body.trim()}\n` : "_(describe the idea; use bullet points for future tasks)_\n"));

fs.writeFileSync(file, fm(front) + body);
try { tagFile(file); } catch {}

console.log(`Captured idea: ${path.relative(VAULT, file)}  (status: captured)`);
if (bullets.length) console.log(`  ${bullets.length} bullet(s) ready to seed as kanban cards on graduation.`);
logActivity(`idea: ${title}`);

// ---------------------------------------------------------------------------

function splitBullets(text) {
  if (!text) return [];
  return String(text)
    .split(/\n|;\s+/)
    .map((s) => s.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
}

function parseFlags(arr) {
  const out = { _: [] };
  const val = new Set(["body", "tags", "project"]);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) { const k = a.slice(2); if (val.has(k)) out[k] = arr[++i]; else out[k] = true; }
    else out._.push(a);
  }
  return out;
}
