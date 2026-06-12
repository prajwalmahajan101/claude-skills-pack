#!/usr/bin/env node
// Subcommands: add, done. Usage from CLI:
//   node task.js add "<text>" [--project <slug>] [--due <YYYY-MM-DD>] [--tag <t>]...
//   node task.js done <n-or-prefix> [--project <slug>]

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { ensureDirs, projectSlugFromCwd, paths, VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { addTask, moveTask, parseBoard, extractWikilink } = require(path.join(SKILL_LIB, "kanban.js"));
const { updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const sub = args.shift();
if (!sub) usage();

// Dispatch `task new "<title>"` to the rich runner.
if (sub === "new") {
  const r = spawnSync(process.execPath, [path.join(__dirname, "task-new.js"), ...args], { stdio: "inherit" });
  process.exit(r.status || 0);
}

const opts = parseFlags(args);
const positional = opts._;
const slug = opts.project || projectSlugFromCwd(process.cwd());
const p = ensureDirs(slug);

if (sub === "add") {
  const text = positional.join(" ").trim();
  if (!text) { console.error("Need task text"); process.exit(1); }
  const tags = Array.isArray(opts.tag) ? opts.tag : opts.tag ? [opts.tag] : [];
  addTask(p.projectKanban, slug, text, { tags, due: opts.due || null });
  console.log(`Added to ${slug} → To Do: ${text}`);
} else if (sub === "done") {
  const selector = positional.join(" ").trim();
  if (!selector) { console.error("Need index or prefix"); process.exit(1); }
  // Look up the task BEFORE moving (so we know if it has a wikilink → task note)
  const before = parseBoard(p.projectKanban).columns["To Do"];
  const idx = /^\d+$/.test(selector) ? parseInt(selector, 10) - 1 : before.findIndex(t => t.text.toLowerCase().includes(selector.toLowerCase()));
  const matchedTask = before[idx];
  const ok = moveTask(p.projectKanban, slug, selector, "Done");
  if (ok && matchedTask) {
    const link = extractWikilink(matchedTask.text);
    if (link) {
      const taskFile = path.join(p.projectTasks, `${link}.md`);
      if (require("node:fs").existsSync(taskFile)) {
        updateFrontmatter(taskFile, { status: "done", completed_at: new Date().toISOString() });
        console.log(`Moved to Done in ${slug}: ${matchedTask.text}\n  task note updated: ${path.relative(VAULT, taskFile)}`);
        process.exit(0);
      }
    }
  }
  console.log(ok ? `Moved to Done in ${slug}: ${selector}` : `Not found in ${slug} To Do: ${selector}`);
  process.exit(ok ? 0 : 1);
} else if (sub === "doing") {
  const selector = positional.join(" ").trim();
  const ok = moveTask(p.projectKanban, slug, selector, "Doing");
  console.log(ok ? `Moved to Doing: ${selector}` : `Not found: ${selector}`);
} else {
  usage();
}

function parseFlags(arr) {
  const out = { _: [] };
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[++i] : true;
      if (out[key] === undefined) out[key] = val;
      else out[key] = [].concat(out[key], val);
    } else {
      out._.push(a);
    }
  }
  return out;
}

function usage() {
  console.error("usage: task.js {add|done|doing} <args> [--project slug] [--due ...] [--tag ...]");
  process.exit(2);
}
