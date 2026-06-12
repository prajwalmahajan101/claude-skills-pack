#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { projectSlugFromCwd, paths, readSessionMap, VAULT, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { countKanban } = require(path.join(SKILL_LIB, "kanban.js"));

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

const lines = [
  `Project: ${slug}  (${cwd})`,
  `  Conversations: ${projectSessions.length} total, ${projectUnanalyzed} un-analyzed`,
  `  Tasks:         ${projKanban.todo} To Do, ${projKanban.doing} Doing, ${projKanban.done} Done`,
  `  Plans:         ${projPlans} mirrored`,
  `  Lessons:       ${projLessons} captured`,
  ``,
  `Across all projects:`,
  `  Un-analyzed conversations: ${allUnanalyzed}`,
  `  Open tasks:                ${totalOpenTasks}`,
  `  Recent lessons (last 7d):  ${recentLessons}`,
  `  Sessions — crashed: ${crashed}, in-progress: ${inProgress}, cleared: ${cleared}`,
];
console.log(lines.join("\n"));

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
