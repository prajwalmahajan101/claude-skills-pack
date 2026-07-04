#!/usr/bin/env node
// Manually capture a lesson from the current session.
// Usage: lesson.js "<title>" [--session <sid>] [--memory]
// Reads the current session conversation file, asks analyzer for a single-lesson schema,
// writes lessons/<date>-<slug>.md as an AI-first note and links it back. With --memory
// (or when the model flags it durable) also promotes the lesson to harness file-memory.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { paths, readSessionMap, slugify, VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { fm, parseFrontmatter, updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { tagFile, mergeTags } = require(path.join(SKILL_LIB, "tagger.js"));
const { preambleBlock, aiFirstFront, unverifiedFront, aiCallout } = require(path.join(SKILL_LIB, "ai-first.js"));
const { promoteFact } = require(path.join(SKILL_LIB, "memory-bridge.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const MODEL = process.env.SB_ANALYZER_MODEL || "claude-haiku-4-5-20251001";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const args = process.argv.slice(2);
let title = "";
let sid = null;
let forceMemory = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--session") sid = args[++i];
  else if (args[i] === "--memory") forceMemory = true;
  else title = (title ? title + " " : "") + args[i];
}
title = title.replace(/^["']|["']$/g, "").trim();
if (!title) { console.error("Need a title"); process.exit(2); }

const map = readSessionMap();
let conv;
if (sid) {
  conv = map[sid] || Object.entries(map).find(([k]) => k.startsWith(sid))?.[1];
} else {
  // Pick the most recently updated conversation
  conv = Object.values(map).sort((a, b) => (b.lastWriteAt || "").localeCompare(a.lastWriteAt || ""))[0];
}
if (!conv || !conv.file || !fs.existsSync(conv.file)) {
  console.error("No conversation found to attach this lesson to.");
  process.exit(1);
}

const transcript = fs.readFileSync(conv.file, "utf8");

const prompt = `Given this conversation transcript, write a single lesson note titled "${title}".

Return ONLY a JSON object with these fields:
{
  "preamble": "2-3 sentence machine summary for a future AI reader: what this lesson is and why it matters",
  "body": "2-5 sentences capturing the insight and WHY it matters; attach (as of YYYY-MM, source) to any external fact",
  "tags": ["#area/sub", ...],
  "confidence": "stated|high|medium|speculation",
  "durable": true|false  // true if this is a reusable pattern/principle/gotcha worth cross-session memory
}

No prose, no fences.

---

${transcript.slice(0, 80000)}`;

const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
  input: prompt, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error(`claude -p failed: ${r.stderr || r.status}`);
  process.exit(1);
}

let parsed;
try {
  let t = r.stdout.trim();
  if (t.startsWith("```")) t = t.replace(/^```(json)?\n/, "").replace(/\n```\s*$/, "");
  parsed = JSON.parse(t.match(/\{[\s\S]*\}/)[0]);
} catch (e) {
  console.error("Could not parse model output:", e.message);
  process.exit(1);
}

const p = paths(conv.project);
const date = new Date().toISOString().slice(0, 10);
const lslug = slugify(title);
const lfile = path.join(p.lessons, `${date}-${lslug}.md`);
fs.mkdirSync(path.dirname(lfile), { recursive: true });

const sourceSession = Object.entries(map).find(([, v]) => v === conv)?.[0] || null;
// The lesson body is Haiku-drafted → mark it unverified and flag it visibly so it
// enters the /sb:verify review queue rather than silently hardening into fact.
const front = unverifiedFront(aiFirstFront({
  type: "lesson",
  date,
  source_session: sourceSession,
  source_project: conv.project,
  manual: true,
  tags: mergeTags(parsed.tags || []),
}, { confidence: parsed.confidence }), MODEL);

const body = `# ${title}\n\n${aiCallout(MODEL)}\n${preambleBlock(parsed.preamble)}\n${parsed.body}\n\n## Source\n[[${path.basename(conv.file, ".md")}]]\n`;
fs.writeFileSync(lfile, fm(front) + body);
tagFile(lfile);

console.log(`Wrote: ${path.relative(VAULT, lfile)}`);

// Log the capture to the remember rolling history (best-effort, never throws).
logActivity(`lesson: ${title} (${conv.project})`);

// Promote durable lessons to harness file-memory so they persist cross-session.
if ((forceMemory || parsed.durable) && process.env.SB_MEMORY_PROMOTE !== "0") {
  const { file } = promoteFact({
    name: lslug,
    description: title,
    type: "reference",
    body: `${parsed.preamble || parsed.body}\n\nSource lesson: [[${path.basename(lfile, ".md")}]] (sb ${path.relative(VAULT, lfile)}).`,
    session: sourceSession,
    hook: title,
  });
  console.log(`Promoted to memory: ${path.relative(os.homedir(), file)}`);
}
