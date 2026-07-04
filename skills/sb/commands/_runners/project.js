#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { paths, readSessionMap, VAULT, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const { countKanban } = require(path.join(SKILL_LIB, "kanban.js"));

const arg = process.argv[2];

if (arg) {
  const p = paths(arg);
  if (!fs.existsSync(p.projectIndex)) {
    console.error(`No project: ${arg}`);
    process.exit(1);
  }
  console.log(fs.readFileSync(p.projectIndex, "utf8"));
  process.exit(0);
}

const projectsDir = path.join(VAULT, DIR.projects);
if (!fs.existsSync(projectsDir)) { console.log("(no projects yet)"); process.exit(0); }

const map = readSessionMap();
const sessByProject = {};
for (const s of Object.values(map)) {
  sessByProject[s.project] = (sessByProject[s.project] || 0) + 1;
}

const rows = [];
for (const slug of fs.readdirSync(projectsDir).sort()) {
  const p = paths(slug);
  const k = countKanban(p.projectKanban);
  const lessons = fs.existsSync(p.projectLessons)
    ? (fs.readFileSync(p.projectLessons, "utf8").match(/^##\s/gm) || []).length
    : 0;
  let last = "-";
  try { last = new Date(fs.statSync(p.project).mtimeMs).toISOString().slice(0, 10); } catch {}
  rows.push({ slug, convs: sessByProject[slug] || 0, tasks: k.todo + k.doing, lessons, last });
}

const w = {
  slug: Math.max(7, ...rows.map(r => r.slug.length)),
};
console.log(["PROJECT".padEnd(w.slug), "CONVS", "TASKS", "LESSONS", "LAST"].join("  "));
for (const r of rows) {
  console.log([r.slug.padEnd(w.slug), String(r.convs).padStart(5), String(r.tasks).padStart(5), String(r.lessons).padStart(7), r.last].join("  "));
}
