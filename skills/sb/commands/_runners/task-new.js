#!/usr/bin/env node
// /sb:task new "<title>" — create a rich task note AND add a wikilinked kanban entry.
// Usage: task-new.js "<title>" [--project <slug>] [--due YYYY-MM-DD] [--tag <t>]...

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
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
const front = {
  type: "task",
  project: slug,
  title,
  status: "open",
  created: new Date().toISOString(),
  completed_at: null,
  due,
  tags: tags.map(t => t.startsWith("#") ? t : `#${t}`),
  related: [],
};
const body = `# ${title}\n\n## Context\n\n\n## Goal\n\n\n## Sub-steps\n- [ ] \n\n## Blockers\nNone yet.\n\n## Related\n\n\n## Notes\n\n`;
fs.writeFileSync(taskFile, fm(front) + body);

// Add to kanban with wikilink to the task note.
addTask(p.projectKanban, slug, title, { tags, due, noteLink: noteName });

console.log(`Created task: ${path.relative(VAULT, taskFile)}`);
console.log(`Added to ${slug} kanban (To Do).`);

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
