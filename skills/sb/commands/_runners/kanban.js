#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { projectSlugFromCwd, paths, VAULT_NAME } = require(path.join(SKILL_LIB, "vault.js"));

const args = process.argv.slice(2);
const open = args.includes("--open");
const pi = args.indexOf("--project");
const slug = pi >= 0 ? args[pi + 1] : projectSlugFromCwd(process.cwd());
const p = paths(slug);

if (open) {
  const rel = path.relative(p.vault, p.projectKanban);
  const r = spawnSync("obsidian", [`vault=${VAULT_NAME}`, "open", `path=${rel}`], { stdio: "inherit" });
  process.exit(r.status || 0);
}

if (!fs.existsSync(p.projectKanban)) {
  console.error(`No kanban for project: ${slug}`);
  process.exit(1);
}
console.log(fs.readFileSync(p.projectKanban, "utf8"));
