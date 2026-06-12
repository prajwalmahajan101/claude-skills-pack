#!/usr/bin/env node
// Manually capture a lesson from the current session.
// Usage: lesson.js "<title>" [--session <sid>]
// Reads the current session conversation file, asks analyzer for a single-lesson schema,
// writes lessons/<date>-<slug>.md and links it back.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { paths, readSessionMap, slugify, VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { fm, parseFrontmatter, updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { tagFile, mergeTags } = require(path.join(SKILL_LIB, "tagger.js"));

const MODEL = process.env.SB_ANALYZER_MODEL || "claude-haiku-4-5-20251001";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const args = process.argv.slice(2);
let title = "";
let sid = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--session") sid = args[++i];
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

Return ONLY a JSON object: {"body": "2-5 sentences capturing the insight and WHY it matters", "tags": ["#area/sub", ...]}

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

const front = {
  type: "lesson",
  date,
  source_session: Object.entries(map).find(([, v]) => v === conv)?.[0] || null,
  source_project: conv.project,
  manual: true,
  tags: mergeTags(parsed.tags || []),
};
const body = `# ${title}\n\n${parsed.body}\n\n## Source\n[[${path.basename(conv.file, ".md")}]]\n`;
fs.writeFileSync(lfile, fm(front) + body);
tagFile(lfile);

console.log(`Wrote: ${path.relative(VAULT, lfile)}`);
