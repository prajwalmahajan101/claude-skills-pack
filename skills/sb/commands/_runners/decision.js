#!/usr/bin/env node
// decision.js — capture an architecture decision (ADR) as an AI-first vault note.
// Usage: decision.js "<title>" [--project <slug>] [--from-council] [--status accepted]
//        [--context "..."] [--decision "..."] [--consequences "..."]
//
// Writes a numbered NNNN-<slug>.md ADR into 02_Projects/<slug>/decisions/ following
// the Context / Decision / Consequences / Usage template the user's CLAUDE.md
// mandates, and drops a linked copy into the global 11_Decisions/ folder. If the
// body sections are not supplied, drafts them with Haiku from the current session.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, DIR, paths, ensureDirs, projectSlugFromCwd, slugify, readSessionMap } = require(path.join(SKILL_LIB, "vault.js"));
const { fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock, aiFirstFront, unverifiedFront, aiCallout } = require(path.join(SKILL_LIB, "ai-first.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const MODEL = process.env.SB_ANALYZER_MODEL || "claude-haiku-4-5-20251001";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const opts = parseFlags(process.argv.slice(2));
const title = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
if (!title) { console.error('Usage: decision.js "<title>" [--project slug] [--from-council]'); process.exit(2); }

const slug = opts.project || projectSlugFromCwd(process.cwd());
const p = ensureDirs(slug);
const decisionsDir = path.join(p.project, "decisions");
fs.mkdirSync(decisionsDir, { recursive: true });

const n = nextNumber(decisionsDir);
const dslug = slugify(title);
const num = String(n).padStart(4, "0");
const fileName = `${num}-${dslug}.md`;

let sections = {
  context: opts.context || "",
  decision: opts.decision || "",
  consequences: opts.consequences || "",
  usage: opts.usage || "",
};
let drafted = false;
if (!sections.context && !sections.decision) {
  const d = draftFromSession(title);
  if (d) { sections = d; drafted = true; }
}

const date = new Date().toISOString().slice(0, 10);
// Haiku-drafted ADRs are unverified until a human reviews; user-dictated ones are trusted.
const baseFront = aiFirstFront({
  type: "decision",
  adr: num,
  project: slug,
  date,
  status: opts.status || "accepted",
  source: opts["from-council"] ? "council" : "manual",
  tags: ["decision", "adr", `project/${slug}`],
});
const front = drafted ? unverifiedFront(baseFront, MODEL) : baseFront;

const body =
  `# ${num}. ${title}\n\n` +
  (drafted ? aiCallout(MODEL) + "\n" : "") +
  preambleBlock(`ADR ${num} for ${slug}: ${title}. Records the context, the decision, and its consequences so future-Claude understands why the codebase is shaped this way.`) +
  "\n" +
  `## Status\n${front.status}\n\n` +
  `## Context\n${sections.context || "TBD"}\n\n` +
  `## Decision\n${sections.decision || "TBD"}\n\n` +
  `## Consequences\n${sections.consequences || "TBD"}\n\n` +
  `## Usage\n${sections.usage || "TBD"}\n` +
  (opts["from-council"] ? `\n## Voices (council)\nCaptured from a council session.\n` : "");

const projectFile = path.join(decisionsDir, fileName);
fs.writeFileSync(projectFile, fm(front) + body);

// Linked copy in the global decisions folder.
const globalFile = path.join(VAULT, DIR.decisions, `${slug}-${fileName}`);
fs.mkdirSync(path.dirname(globalFile), { recursive: true });
fs.writeFileSync(globalFile, fm({ ...front, canonical: `[[${num}-${dslug}]]` }) + body);

console.log(`Wrote ADR: ${path.relative(VAULT, projectFile)}`);
console.log(`Global copy: ${path.relative(VAULT, globalFile)}`);
logActivity(`decision ${num}: ${title} (${slug})`);

// ---------------------------------------------------------------------------

function nextNumber(dir) {
  let max = 0;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(\d{4})-/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function draftFromSession(title) {
  const map = readSessionMap();
  const conv = Object.values(map).sort((a, b) => (b.lastWriteAt || "").localeCompare(a.lastWriteAt || ""))[0];
  if (!conv || !conv.file || !fs.existsSync(conv.file)) return null;
  const transcript = fs.readFileSync(conv.file, "utf8").slice(0, 80000);
  const prompt = `From this conversation, draft an ADR titled "${title}".
Return ONLY JSON: {"context":"why this came up / forces at play","decision":"what was decided","consequences":"tradeoffs, what becomes easier/harder","usage":"how future work should apply it"}.
No prose, no fences.

---

${transcript}`;
  const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
    input: prompt, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  try {
    let t = r.stdout.trim();
    if (t.startsWith("```")) t = t.replace(/^```(json)?\n/, "").replace(/\n```\s*$/, "");
    return JSON.parse(t.match(/\{[\s\S]*\}/)[0]);
  } catch { return null; }
}

function parseFlags(arr) {
  const out = { _: [] };
  const val = new Set(["project", "status", "context", "decision", "consequences", "usage"]);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      if (val.has(k)) out[k] = arr[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}
