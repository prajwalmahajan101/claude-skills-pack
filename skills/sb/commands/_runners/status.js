#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { projectSlugFromCwd, paths, readSessionMap, VAULT, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { countKanban } = require(path.join(SKILL_LIB, "kanban.js"));
const { listFacts } = require(path.join(SKILL_LIB, "memory-bridge.js"));
const { recentHighlights } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const cwd = process.argv[2] || process.cwd();
const slug = projectSlugFromCwd(cwd);
const p = paths(slug);

const map = readSessionMap();
const allSessions = Object.values(map);
const projectSessions = allSessions.filter((s) => s.project === slug);

let projectUnanalyzed = 0, allUnanalyzed = 0;
let crashed = 0, inProgress = 0, cleared = 0;
for (const s of allSessions) {
  if (!s.file || !fs.existsSync(s.file)) continue;
  try {
    const { meta } = parseFrontmatter(fs.readFileSync(s.file, "utf8"));
    if (meta.analyzed === false) {
      allUnanalyzed++;
      if (s.project === slug) projectUnanalyzed++;
    }
    if (meta.ended_reason === "crashed") crashed++;
    else if (meta.ended_reason === "in-progress") inProgress++;
    else if (meta.ended_reason === "cleared") cleared++;
  } catch {}
}

const projKanban = countKanban(p.projectKanban);
const projPlans = fs.existsSync(p.projectPlans) ? fs.readdirSync(p.projectPlans).filter(f => f.endsWith(".md")).length : 0;
const projLessons = lessonCount(p.projectLessons);

let totalOpenTasks = 0;
const projectsDir = path.join(VAULT, DIR.projects);
if (fs.existsSync(projectsDir)) {
  for (const sub of fs.readdirSync(projectsDir)) {
    const k = countKanban(path.join(projectsDir, sub, "kanban.md"));
    totalOpenTasks += k.todo + k.doing;
  }
}

const recentLessons = countRecentLessons(p.lessons, 7);
const memFacts = safe(() => listFacts().length, 0);
const highlights = safe(() => recentHighlights(3), []);
const journals = safe(() => countMd(path.join(p.project, "journal")), 0);
const reviews = safe(() => countMd(path.join(p.project, "reviews")), 0);
const decisions = safe(() => countMd(path.join(p.project, "decisions")), 0);
const zettels = safe(() => countMd(p.zettel), 0);
const meetings = safe(() => countMd(p.meetings), 0);
const people = safe(() => countMd(p.people), 0);
const habitsN = safe(() => countMd(p.habits), 0);
const ideasN = safe(() => countMd(p.ideas), 0);
const synthesisN = safe(() => countByType(p.insights, "synthesis"), 0);
const unverified = safe(() => countUnverified(), 0);
const evalR5 = safe(() => lastEvalRecall5(), null);

const lines = [
  `Project: ${slug}  (${cwd})`,
  `  Conversations: ${projectSessions.length} total, ${projectUnanalyzed} un-analyzed`,
  `  Tasks:         ${projKanban.todo} To Do, ${projKanban.doing} Doing, ${projKanban.done} Done`,
  `  Plans:         ${projPlans} mirrored`,
  `  Lessons:       ${projLessons} captured`,
  `  Artifacts:     ${journals} journal(s), ${reviews} review file(s), ${decisions} decision(s)`,
  ``,
  `Across all projects:`,
  `  Un-analyzed conversations: ${allUnanalyzed}`,
  `  Open tasks:                ${totalOpenTasks}`,
  `  Recent lessons (last 7d):  ${recentLessons}`,
  `  Sessions — crashed: ${crashed}, in-progress: ${inProgress}, cleared: ${cleared}`,
  ``,
  `Knowledge base:`,
  `  Zettels: ${zettels}  Meetings: ${meetings}  People: ${people}  Habits: ${habitsN}`,
  `  Ideas: ${ideasN}  Synthesis pages: ${synthesisN}`,
  `  Unverified notes (review): ${unverified}`,
  `  Retrieval recall@5: ${evalR5 == null ? "(run /sb:eval)" : evalR5}`,
  ``,
  `External memory:`,
  `  Harness memory facts:      ${memFacts}`,
  `  Remember (recent):         ${highlights.length ? "" : "(none)"}`,
  ...highlights.map((h) => `    - ${h.slice(0, 100)}`),
];
console.log(lines.join("\n"));

function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }
function countMd(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length : 0; }
function countByType(dir, type) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    try { if (new RegExp(`^type:\\s*${type}\\b`, "m").test(fs.readFileSync(path.join(dir, f), "utf8"))) n++; } catch {}
  }
  return n;
}
function lastEvalRecall5() {
  const file = path.join(p.meta, "eval-results.json");
  if (!fs.existsSync(file)) return null;
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  const v = r.recall_at_5 != null ? r.recall_at_5 : (r.overall && r.overall.recall ? r.overall.recall[5] : null);
  return v == null ? null : v;
}
function countUnverified() {
  let n = 0;
  const stack = [VAULT];
  const skip = new Set(["_meta", "_templates", "_assets", "__scribble", ".obsidian", ".trash"]);
  while (stack.length) {
    const d = stack.pop();
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (e.name.startsWith(".") || skip.has(e.name)) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name.endsWith(".md")) {
        try { if (/^verified:\s*false/m.test(fs.readFileSync(full, "utf8"))) n++; } catch {}
      }
    }
  }
  return n;
}

function lessonCount(file) {
  if (!fs.existsSync(file)) return 0;
  const text = fs.readFileSync(file, "utf8");
  return (text.match(/^##\s/gm) || []).length;
}

function countRecentLessons(dir, days) {
  if (!fs.existsSync(dir)) return 0;
  const cutoff = Date.now() - days * 86400000;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    try {
      const st = fs.statSync(path.join(dir, f));
      if (st.mtimeMs >= cutoff) n++;
    } catch {}
  }
  return n;
}
