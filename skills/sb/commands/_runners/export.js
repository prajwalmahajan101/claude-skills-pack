#!/usr/bin/env node
// /sb:export <topic-slug-or-tag> — bundle a topic + all wikilinked + tagged notes into one file.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, paths, slugify, DIR, EXCLUDE_FOLDERS } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const target = process.argv[2];
if (!target) { console.error("Usage: export.js <topic-slug-or-#tag>"); process.exit(2); }

const exportsDir = path.join(VAULT, DIR.exports);
fs.mkdirSync(exportsDir, { recursive: true });

const isTag = target.startsWith("#");
const date = new Date().toISOString().slice(0, 10);
const outFile = path.join(exportsDir, `${date}-${slugify(target.replace(/^#/, ""))}.md`);

const included = [];
walk(VAULT, (f) => {
  if (path.relative(VAULT, f).startsWith(DIR.exports + "/")) return;
  try {
    const text = fs.readFileSync(f, "utf8");
    const { meta } = parseFrontmatter(text);
    if (isTag) {
      const norm = target.toLowerCase();
      if ((meta.tags || []).some(t => String(t).toLowerCase() === norm)) included.push({ f, text });
    } else {
      const base = path.basename(f, ".md");
      if (base === target || base === `${DIR.topics}/${target}` || meta.slug === target) included.push({ f, text });
      // Also pull in anything that wikilinks to this slug
      else if (text.includes(`[[${target}]]`)) included.push({ f, text });
    }
  } catch {}
});

if (included.length === 0) { console.log("(no matches)"); process.exit(0); }

const lines = [
  `# Export: ${target}`,
  ``,
  `Generated ${new Date().toISOString()} from \`ai-mind\` vault.`,
  ``,
  `Includes ${included.length} note${included.length === 1 ? "" : "s"}.`,
  ``,
  `---`,
  ``,
];
for (const i of included) {
  lines.push(`## ${path.relative(VAULT, i.f)}`, "", i.text, "", "---", "");
}
fs.writeFileSync(outFile, lines.join("\n"));
console.log(`Wrote: ${path.relative(VAULT, outFile)}  (${included.length} notes)`);

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
