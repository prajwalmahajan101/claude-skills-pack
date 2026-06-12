#!/usr/bin/env node
// Suggest links between the target note and existing vault notes.
// Default target: current session's conversation file. Override with --file <path>.
// Output is the ranked list; the user picks via /sb:connect (Claude handles the picking conversationally).

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { paths, readSessionMap, VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { suggest, writeConnection } = require(path.join(SKILL_LIB, "connector.js"));

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const acceptIdx = args.indexOf("--accept");
const themeIdx = args.indexOf("--theme");
const file = fileIdx >= 0 ? args[fileIdx + 1] : currentSessionFile();
if (!file) { console.error("No target file. Pass --file <path>."); process.exit(1); }

if (acceptIdx >= 0) {
  const members = args[acceptIdx + 1].split(",").map((p) => p.trim()).filter(Boolean);
  const theme = themeIdx >= 0 ? args[themeIdx + 1] : path.basename(file, ".md");
  const out = writeConnection(theme, members, file);
  console.log(`Wrote: ${path.relative(VAULT, out)}`);
  process.exit(0);
}

const ranked = suggest(file, 5);
if (!ranked.length) {
  console.log("(no candidates above threshold)");
  process.exit(0);
}

console.log(`Target: ${path.relative(VAULT, file)}`);
console.log("Candidates (top 5):");
ranked.forEach((r, i) => {
  console.log(`  [${i + 1}] ${r.note.rel}  (${r.sharedTags.length} shared tags, score ${r.score.toFixed(2)})`);
});

function currentSessionFile() {
  const map = readSessionMap();
  const latest = Object.values(map).sort((a, b) => (b.lastWriteAt || "").localeCompare(a.lastWriteAt || ""))[0];
  return latest?.file || null;
}
