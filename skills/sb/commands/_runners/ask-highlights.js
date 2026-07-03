#!/usr/bin/env node
// ask-highlights.js — hallucination-proof retrieval: return only VERBATIM vault
// lines that match the query, never generated prose.
// Usage: ask-highlights.js "<query>" [--type <noteType>] [--limit N]
//
// Scans the vault for lines containing the query terms, preferring "highlight"
// lines (quotes, > callouts, ==highlights==, bullet claims). Every result carries
// file:line provenance so the source can be opened and trusted.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, EXCLUDE_FOLDERS, folderToType } = require(path.join(SKILL_LIB, "vault.js"));

const args = process.argv.slice(2);
let type = null, limit = 25;
const words = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--type") type = args[++i];
  else if (args[i] === "--limit") limit = parseInt(args[++i], 10) || 25;
  else words.push(args[i]);
}
const query = words.join(" ").replace(/^["']|["']$/g, "").trim();
if (!query) { console.error('Usage: ask-highlights.js "<query>" [--type t] [--limit N]'); process.exit(2); }

const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
const results = [];

walk(VAULT, (file) => {
  const rel = path.relative(VAULT, file);
  const top = rel.split(path.sep)[0];
  if (type && folderToType(top) !== type) return;
  let lines;
  try { lines = fs.readFileSync(file, "utf8").split("\n"); } catch { return; }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("---") || line.startsWith("#")) continue;
    const low = line.toLowerCase();
    const hits = terms.filter((t) => low.includes(t)).length;
    if (hits === 0) continue;
    results.push({ rel, line: i + 1, text: line, score: hits + (isHighlight(line) ? 2 : 0) });
  }
});

results.sort((a, b) => b.score - a.score);
const top = results.slice(0, limit);

if (!top.length) {
  console.log(`No verbatim matches for "${query}".`);
} else {
  console.log(`Verbatim highlights for "${query}" (${top.length} of ${results.length}) — quotes only, nothing generated:\n`);
  for (const r of top) {
    console.log(`• ${r.text}`);
    console.log(`    — ${r.rel}:${r.line}\n`);
  }
}

function isHighlight(line) {
  return /^>/.test(line) || /==.+==/.test(line) || /^[-*]\s+/.test(line) || /["“].+["”]/.test(line);
}

function walk(dir, fn) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.name.endsWith(".md")) fn(full);
  }
}
