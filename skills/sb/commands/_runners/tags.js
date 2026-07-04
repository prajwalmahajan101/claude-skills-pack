#!/usr/bin/env node
// /sb:tags — show tag hierarchy with counts. --prune purges invalid tags from all notes.
const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, EXCLUDE_FOLDERS } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter, fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { mergeTags, rebuildTagsIndex } = require(path.join(SKILL_LIB, "tagger.js"));

const args = process.argv.slice(2);
const prune = args.includes("--prune");

let pruned = 0;
const counts = {};
walk(VAULT, (f) => {
  try {
    const text = fs.readFileSync(f, "utf8");
    const { meta, body } = parseFrontmatter(text);
    const tags = meta.tags || [];
    const cleaned = mergeTags(tags); // mergeTags drops invalid + applies aliases
    if (prune && cleaned.length !== tags.length) {
      meta.tags = cleaned;
      fs.writeFileSync(f, fm(meta) + body);
      pruned++;
    }
    for (const t of (prune ? cleaned : tags)) {
      if (!t || typeof t !== "string") continue;
      counts[t.toLowerCase()] = (counts[t.toLowerCase()] || 0) + 1;
    }
  } catch {}
});

if (prune) {
  rebuildTagsIndex();
  console.log(`Pruned tags in ${pruned} notes.`);
}

// Hierarchical print
const tree = {};
for (const [tag, n] of Object.entries(counts)) {
  const parts = tag.replace(/^#/, "").split("/");
  let node = tree;
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i];
    node[k] = node[k] || { _count: 0, _children: {} };
    if (i === parts.length - 1) node[k]._count += n;
    node = node[k]._children;
  }
}

console.log(`Tags (${Object.keys(counts).length} unique, ${Object.values(counts).reduce((a,b)=>a+b,0)} assignments):\n`);
function print(node, prefix = "") {
  const keys = Object.keys(node).sort();
  for (const k of keys) {
    const c = node[k];
    const count = c._count > 0 ? ` (${c._count})` : "";
    console.log(`${prefix}#${prefix.replace(/[│├└─ ]/g, "")}${k}${count}`);
    print(c._children, prefix + "  ");
  }
}
// Simpler: flat sorted list
for (const [tag, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${tag.padEnd(40)} ${n}`);
}

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
