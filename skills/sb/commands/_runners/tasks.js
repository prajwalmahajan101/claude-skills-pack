#!/usr/bin/env node
// List pending kanban tasks for current project (default) or all (--all).
const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { projectSlugFromCwd, paths, VAULT, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const { parseBoard } = require(path.join(SKILL_LIB, "kanban.js"));

const args = process.argv.slice(2);
const all = args.includes("--all");
const projIdx = args.indexOf("--project");
const projectArg = projIdx >= 0 ? args[projIdx + 1] : null;

if (all) {
  const projectsDir = path.join(VAULT, DIR.projects);
  if (!fs.existsSync(projectsDir)) { console.log("(no projects)"); process.exit(0); }
  let any = false;
  for (const slug of fs.readdirSync(projectsDir).sort()) {
    const b = parseBoard(paths(slug).projectKanban);
    const pending = [...b.columns["Doing"], ...b.columns["To Do"]];
    if (!pending.length) continue;
    any = true;
    console.log(`${slug} (${pending.length}):`);
    pending.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t.text}`));
    console.log("");
  }
  if (!any) console.log("(no open tasks across any project)");
} else {
  const slug = projectArg || projectSlugFromCwd(process.cwd());
  const b = parseBoard(paths(slug).projectKanban);
  console.log(`${slug} — Doing:`);
  b.columns["Doing"].forEach((t, i) => console.log(`  ${i + 1}. ${t.text}`));
  if (!b.columns["Doing"].length) console.log("  (none)");
  console.log(`\n${slug} — To Do:`);
  b.columns["To Do"].forEach((t, i) => console.log(`  ${i + 1}. ${t.text}`));
  if (!b.columns["To Do"].length) console.log("  (none)");
}
