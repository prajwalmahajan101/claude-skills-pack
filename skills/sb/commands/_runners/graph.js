#!/usr/bin/env node
// graph.js — helper for /sb:graph. graphify itself is an agent-driven skill, so
// this runner only (a) resolves the path graphify should target and (b) mirrors
// graphify-out/ into the vault afterward.
//
// Usage:
//   graph.js resolve [--project <slug>]     -> prints the absolute path to graph
//   graph.js mirror --from <dir> [--project <slug>]  -> copy <dir>/graphify-out into vault

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, DIR, paths, projectSlugFromCwd, readSessionMap } = require(path.join(SKILL_LIB, "vault.js"));
const { repoRoot } = require(path.join(SKILL_LIB, "git.js"));

const sub = process.argv[2];
const opts = parseFlags(process.argv.slice(3));

if (sub === "resolve") {
  process.stdout.write(resolveTarget() + "\n");
} else if (sub === "mirror") {
  mirror();
} else {
  console.error("Usage: graph.js resolve|mirror [--project <slug>] [--from <dir>]");
  process.exit(2);
}

function resolveTarget() {
  if (opts.project) {
    const repo = repoForSlug(opts.project);
    if (repo) return repo;
    // Fall back to the project folder in the vault if no repo path is known.
    return paths(opts.project).project;
  }
  return VAULT; // default: graph the whole vault
}

function mirror() {
  const from = opts.from || resolveTarget();
  const src = path.join(from, "graphify-out");
  if (!fs.existsSync(src)) {
    console.error(`No graphify-out/ under ${from}. Run /graphify "${from}" first.`);
    process.exit(1);
  }
  const label = opts.project || "vault";
  const dest = path.join(VAULT, DIR.exports, "graph", label);
  copyDir(src, dest);
  addDashboardLink(label, dest);
  console.log(`Mirrored graph -> ${path.relative(VAULT, dest)}`);
}

function repoForSlug(slug) {
  const map = readSessionMap();
  for (const e of Object.values(map)) {
    if (e.project === slug && e.project_path) {
      const r = repoRoot(e.project_path);
      if (r) return r;
    }
  }
  return null;
}

function addDashboardLink(label, dest) {
  const home = paths("_").dashboardHome;
  const rel = path.relative(VAULT, path.join(dest, "GRAPH_REPORT.md"));
  const line = `- Knowledge graph (${label}): [[${rel.replace(/\.md$/, "")}]]`;
  let text = fs.existsSync(home) ? fs.readFileSync(home, "utf8") : "# Dashboard\n";
  if (!text.includes(`Knowledge graph (${label})`)) {
    text = text.replace(/\s*$/, "") + "\n" + line + "\n";
    fs.mkdirSync(path.dirname(home), { recursive: true });
    fs.writeFileSync(home, text);
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function parseFlags(arr) {
  const out = {};
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === "--project") out.project = arr[++i];
    else if (arr[i] === "--from") out.from = arr[++i];
  }
  return out;
}
