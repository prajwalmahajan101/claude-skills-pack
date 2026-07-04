#!/usr/bin/env node
// /sb:task new "<title>" — create a rich task note AND add a wikilinked kanban entry.
// Usage: task-new.js "<title>" [--project <slug>] [--due YYYY-MM-DD] [--tag <t>]...

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { ensureDirs, projectSlugFromCwd, paths, slugify, VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { addTask } = require(path.join(SKILL_LIB, "kanban.js"));
const { fm } = require(path.join(SKILL_LIB, "markdown.js"));

const args = process.argv.slice(2);
const opts = parseFlags(args);
const title = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
if (!title) { console.error('Usage: task-new.js "<title>" [--project slug] [--due ...] [--tag ...]'); process.exit(2); }

const slug = opts.project || projectSlugFromCwd(process.cwd());
const p = ensureDirs(slug);
const tags = Array.isArray(opts.tag) ? opts.tag : opts.tag ? [opts.tag] : [];
const due = opts.due || null;

const date = new Date().toISOString().slice(0, 10);
const taskSlug = slugify(title);
const taskFile = path.join(p.projectTasks, `${date}-${taskSlug}.md`);
fs.mkdirSync(path.dirname(taskFile), { recursive: true });

const noteName = `${date}-${taskSlug}`;

// Optional parent (hierarchical sub-tasks). --parent accepts a note slug/basename.
const parent = opts.parent ? String(opts.parent).replace(/\.md$/, "") : null;
const parentFile = parent ? findParent(p.projectTasks, parent) : null;

const front = {
  type: "task",
  project: slug,
  title,
  status: "open",
  created: new Date().toISOString(),
  completed_at: null,
  due,
  parent: parent ? `[[${path.basename(parentFile || parent, ".md")}]]` : null,
  subtask: Boolean(parent),
  tags: tags.map(t => t.startsWith("#") ? t : `#${t}`),
  related: [],
};
const body = `# ${title}\n\n${parent ? `> Sub-task of [[${path.basename(parentFile || parent, ".md")}]]\n\n` : ""}## Context\n\n\n## Goal\n\n\n## Sub-steps\n- [ ] \n\n## Blockers\nNone yet.\n\n## Related\n\n\n## Notes\n\n`;
fs.writeFileSync(taskFile, fm(front) + body);

// Add to kanban (sub-tasks are labelled with a ↳ prefix).
addTask(p.projectKanban, slug, parent ? `↳ ${title}` : title, { tags, due, noteLink: noteName });

// Back-link: add this sub-task to the parent note's "## Sub-tasks" checklist.
if (parentFile && fs.existsSync(parentFile)) {
  let ptext = fs.readFileSync(parentFile, "utf8");
  const entry = `- [ ] [[${noteName}|${title}]]`;
  if (/^## Sub-tasks/m.test(ptext)) ptext = ptext.replace(/^## Sub-tasks.*$/m, (h) => `${h}\n${entry}`);
  else ptext = ptext.replace(/\s*$/, "") + `\n\n## Sub-tasks\n${entry}\n`;
  fs.writeFileSync(parentFile, ptext);
}

console.log(`Created ${parent ? "sub-task" : "task"}: ${path.relative(VAULT, taskFile)}`);
if (parent) console.log(`  Linked under parent: ${parent}`);
console.log(`Added to ${slug} kanban (To Do).`);

function findParent(dir, sel) {
  if (!fs.existsSync(dir)) return null;
  const want = sel.toLowerCase();
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".md") && path.basename(f, ".md").toLowerCase().includes(want)) return path.join(dir, f);
  }
  return null;
}

function parseFlags(arr) {
  const out = { _: [] };
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[++i] : true;
      if (out[k] === undefined) out[k] = v;
      else out[k] = [].concat(out[k], v);
    } else out._.push(a);
  }
  return out;
}
