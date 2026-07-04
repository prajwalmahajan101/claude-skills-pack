#!/usr/bin/env node
// /sb:review — list stale topics + un-analyzed conversations to encourage upkeep.
const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, readSessionMap, paths, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const P = paths("_");
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const STALE_DAYS = parseInt(process.argv.find(a => a.startsWith("--days="))?.split("=")[1] || "30", 10);
const cutoff = Date.now() - STALE_DAYS * 86400000;

console.log(`Review — stale > ${STALE_DAYS} days\n`);

// Stale topics
const topicsDir = P.topics;
const staleTopics = [];
if (fs.existsSync(topicsDir)) {
  for (const f of fs.readdirSync(topicsDir)) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(topicsDir, f);
    try {
      const st = fs.statSync(full);
      if (st.mtimeMs < cutoff) staleTopics.push({ file: f, age: Math.round((Date.now() - st.mtimeMs) / 86400000) });
    } catch {}
  }
}
console.log(`Stale topics (${staleTopics.length}):`);
staleTopics.sort((a, b) => b.age - a.age).slice(0, 15).forEach(t => console.log(`  - ${DIR.topics}/${t.file}  (${t.age}d)`));

// Un-analyzed conversations
const map = readSessionMap();
let unanalyzed = 0;
for (const s of Object.values(map)) {
  if (!s.file || !fs.existsSync(s.file)) continue;
  try {
    const { meta } = parseFrontmatter(fs.readFileSync(s.file, "utf8"));
    if (meta.analyzed === false) unanalyzed++;
  } catch {}
}
console.log(`\nUn-analyzed conversations: ${unanalyzed} (run /sb:analyze to mine them)`);

// Open tasks older than threshold
const tasksRoot = path.join(VAULT, DIR.projects);
const oldTasks = [];
if (fs.existsSync(tasksRoot)) {
  walk(tasksRoot, (f) => {
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(f, "utf8"));
      if (meta.status === "open" && meta.created) {
        const age = Math.round((Date.now() - new Date(meta.created).getTime()) / 86400000);
        if (age >= STALE_DAYS) oldTasks.push({ file: path.relative(VAULT, f), title: meta.title, age });
      }
    } catch {}
  });
}
console.log(`\nOpen tasks older than ${STALE_DAYS}d: ${oldTasks.length}`);
oldTasks.sort((a, b) => b.age - a.age).slice(0, 10).forEach(t => console.log(`  - ${t.file}  (${t.age}d) — ${t.title || ""}`));

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
