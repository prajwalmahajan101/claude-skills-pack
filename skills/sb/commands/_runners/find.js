#!/usr/bin/env node
// /sb:find <fuzzy-query> — fuzzy-match filenames + titles across the vault.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, EXCLUDE_FOLDERS } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const query = process.argv.slice(2).join(" ").toLowerCase().trim();
if (!query) { console.error("Usage: find.js <fuzzy-query>"); process.exit(2); }

const queryChars = query.replace(/\s+/g, "");
const candidates = [];
walk(VAULT, (f) => {
  const rel = path.relative(VAULT, f);
  const base = path.basename(f, ".md").toLowerCase();
  let title = base;
  try { title = (parseFrontmatter(fs.readFileSync(f, "utf8")).meta.title || base).toString().toLowerCase(); } catch {}
  const score = fuzzyScore(queryChars, base) + fuzzyScore(queryChars, title) + (title.includes(query) ? 5 : 0) + (base.includes(query) ? 5 : 0);
  if (score > 0) candidates.push({ rel, title, score });
});

candidates.sort((a, b) => b.score - a.score);
const top = candidates.slice(0, 20);
if (!top.length) { console.log("(no matches)"); process.exit(0); }

const w = Math.max(...top.map(c => c.rel.length));
for (const c of top) {
  console.log(`  ${c.rel.padEnd(w)}  ${c.title}`);
}

function fuzzyScore(needle, hay) {
  // Simple subsequence scoring: all chars present in order = base score; bonuses for adjacency.
  let i = 0, score = 0, lastIdx = -1;
  for (const ch of needle) {
    const idx = hay.indexOf(ch, i);
    if (idx === -1) return 0;
    score += 1;
    if (idx === lastIdx + 1) score += 1; // adjacency bonus
    lastIdx = idx;
    i = idx + 1;
  }
  return score;
}

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
