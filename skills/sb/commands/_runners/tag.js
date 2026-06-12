#!/usr/bin/env node
// Auto-tag a specific file, or all untagged notes in the vault, and rebuild tags.md.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, EXCLUDE_FOLDERS } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { tagFile, rebuildTagsIndex } = require(path.join(SKILL_LIB, "tagger.js"));

const arg = process.argv[2];

if (arg) {
  const tags = tagFile(path.resolve(arg));
  console.log(`Tagged ${arg}: ${tags.join(" ") || "(none)"}`);
  rebuildTagsIndex();
  process.exit(0);
}

let tagged = 0, skipped = 0;
walk(VAULT, (f) => {
  try {
    const { meta } = parseFrontmatter(fs.readFileSync(f, "utf8"));
    if ((meta.tags || []).length) { skipped++; return; }
    const t = tagFile(f);
    if (t.length) tagged++;
  } catch {}
});
const counts = rebuildTagsIndex();
console.log(`Tagged ${tagged} files, skipped ${skipped} already-tagged. Total unique tags: ${Object.keys(counts).length}.`);

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
