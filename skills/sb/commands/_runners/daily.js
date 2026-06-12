#!/usr/bin/env node
// /sb:daily — today's captured conversations, lessons, tasks, topics touched.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, readSessionMap, paths, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const P = paths("_");
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const today = new Date().toISOString().slice(0, 10);
const todayStart = new Date(today).getTime();

function isToday(t) { return t && new Date(t).getTime() >= todayStart; }

// Conversations updated today
const map = readSessionMap();
const convs = Object.entries(map)
  .filter(([_, e]) => isToday(e.lastWriteAt))
  .map(([sid, e]) => ({ sid, ...e }));

// Lessons created today
const lessons = [];
const lessonsDir = P.lessons;
if (fs.existsSync(lessonsDir)) {
  for (const f of fs.readdirSync(lessonsDir)) {
    if (!f.endsWith(".md")) continue;
    if (f.startsWith(today)) lessons.push(f);
  }
}

// Tasks added/done today
const tasksAdded = [], tasksDone = [];
const tasksRoot = path.join(VAULT, DIR.projects);
if (fs.existsSync(tasksRoot)) {
  walk(tasksRoot, (f) => {
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(f, "utf8"));
      if (isToday(meta.created)) tasksAdded.push(path.relative(VAULT, f));
      if (meta.status === "done" && isToday(meta.completed_at)) tasksDone.push(path.relative(VAULT, f));
    } catch {}
  });
}

// Topics touched today
const topicsTouched = [];
const topicsDir = P.topics;
if (fs.existsSync(topicsDir)) {
  for (const f of fs.readdirSync(topicsDir)) {
    const full = path.join(topicsDir, f);
    try {
      const st = fs.statSync(full);
      if (st.mtimeMs >= todayStart) topicsTouched.push(f);
    } catch {}
  }
}

console.log(`Daily — ${today}\n`);
console.log(`Conversations active: ${convs.length}`);
convs.slice(0, 10).forEach(c => console.log(`  - ${c.project} · ${c.sid.slice(0, 8)} · ${c.turnCount || 0} turns`));
console.log(`\nLessons created: ${lessons.length}`);
lessons.slice(0, 15).forEach(l => console.log(`  - ${l}`));
console.log(`\nTasks added: ${tasksAdded.length}`);
tasksAdded.slice(0, 10).forEach(t => console.log(`  - ${t}`));
console.log(`\nTasks done: ${tasksDone.length}`);
tasksDone.slice(0, 10).forEach(t => console.log(`  ✓ ${t}`));
console.log(`\nTopics touched: ${topicsTouched.length}`);
topicsTouched.slice(0, 10).forEach(t => console.log(`  - ${t}`));

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
