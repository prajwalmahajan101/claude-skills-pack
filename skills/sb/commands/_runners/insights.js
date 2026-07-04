#!/usr/bin/env node
// /sb:insights — cross-project pattern detection via tag frequency.
const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, paths } = require(path.join(SKILL_LIB, "vault.js"));
const P = paths("_");
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const MIN_PROJECTS = parseInt(process.env.SB_INSIGHTS_MIN_PROJECTS || "2", 10);
const MIN_LESSONS = parseInt(process.env.SB_INSIGHTS_MIN_LESSONS || "2", 10);

// Collect lesson files grouped by tag → list of {file, project}
const byTag = {};
const lessonsDir = P.lessons;
if (fs.existsSync(lessonsDir)) {
  for (const f of fs.readdirSync(lessonsDir)) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(lessonsDir, f);
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(full, "utf8"));
      for (const t of meta.tags || []) {
        const key = String(t).toLowerCase();
        (byTag[key] = byTag[key] || []).push({ file: f, project: meta.source_project || "?" });
      }
    } catch {}
  }
}

const themes = [];
for (const [tag, lessons] of Object.entries(byTag)) {
  if (lessons.length < MIN_LESSONS) continue;
  const projects = new Set(lessons.map(l => l.project));
  if (projects.size < MIN_PROJECTS) continue;
  themes.push({ tag, count: lessons.length, projects: [...projects], lessons });
}
themes.sort((a, b) => b.count - a.count);

if (themes.length === 0) {
  console.log(`(no recurring themes yet — need ≥ ${MIN_LESSONS} lessons across ≥ ${MIN_PROJECTS} projects per tag)`);
  process.exit(0);
}

console.log(`Recurring themes (${themes.length}):\n`);
for (const t of themes.slice(0, 15)) {
  console.log(`${t.tag}  (${t.count} lessons across ${t.projects.length} projects: ${t.projects.slice(0, 3).join(", ")}${t.projects.length > 3 ? ", …" : ""})`);
  for (const l of t.lessons.slice(0, 3)) console.log(`  - [[${path.basename(l.file, ".md")}]]`);
  if (t.lessons.length > 3) console.log(`  …and ${t.lessons.length - 3} more`);
  console.log("");
}

// Write to connections/
const mocFile = P.insightsMoc;
fs.mkdirSync(path.dirname(mocFile), { recursive: true });
const lines = [
  "---", "type: connection", "theme: recurring-themes", `updated: ${new Date().toISOString()}`, "tags: [moc]", "---",
  "", "# Recurring Themes", "",
  `> Auto-generated. Tags appearing in ≥ ${MIN_LESSONS} lessons across ≥ ${MIN_PROJECTS} projects.`, "",
];
for (const t of themes) {
  lines.push(`## ${t.tag}  (${t.count} lessons / ${t.projects.length} projects)`, "");
  for (const l of t.lessons) lines.push(`- [[${path.basename(l.file, ".md")}]] — _${l.project}_`);
  lines.push("");
}
fs.writeFileSync(mocFile, lines.join("\n") + "\n");
console.log(`Wrote: ${path.relative(VAULT, mocFile)}`);
