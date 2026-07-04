#!/usr/bin/env node
// verify.js — mark an AI-drafted note as human-verified.
// Usage: verify.js <slug-or-path> [--by <name>]
//
// Flips verified:false -> true, stamps verified_by/verified_at, and removes the
// [!ai] "unverified" callout from the body. Resolves a bare slug by scanning the
// vault for a matching note filename.

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, EXCLUDE_FOLDERS } = require(path.join(SKILL_LIB, "vault.js"));
const { fm, parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { stripAiCallout, markVerified } = require(path.join(SKILL_LIB, "ai-first.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const args = process.argv.slice(2);
let by = "human";
let target = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--by") by = args[++i];
  else target = target || args[i];
}
if (!target) { console.error("Usage: verify.js <slug-or-path> [--by <name>]"); process.exit(2); }

const file = resolveNote(target);
if (!file) { console.error(`No note found matching "${target}".`); process.exit(1); }

const raw = fs.readFileSync(file, "utf8");
const { meta, body } = parseFrontmatter(raw);
const newMeta = markVerified(meta, by);
const newBody = stripAiCallout(body).replace(/^\n+/, "\n");
fs.writeFileSync(file, fm(newMeta) + newBody);

console.log(`Verified: ${path.relative(VAULT, file)} (by ${by}).`);
logActivity(`verified: ${path.basename(file, ".md")} (by ${by})`);

function resolveNote(t) {
  if (t.endsWith(".md") && fs.existsSync(t)) return path.resolve(t);
  const want = t.replace(/\.md$/, "").toLowerCase();
  let found = null;
  (function walk(dir) {
    if (found) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (found) return;
      if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md") && path.basename(e.name, ".md").toLowerCase() === want) found = full;
    }
  })(VAULT);
  return found;
}
