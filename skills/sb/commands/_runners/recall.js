#!/usr/bin/env node
// /sb:recall — surface relevant past notes for current session's context.

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, readSessionMap } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { retrieve, tokens, noteSnippet } = require(path.join(SKILL_LIB, "retriever.js"));

// Pick current conversation: most recently written entry in session-map.
const map = readSessionMap();
const current = Object.values(map).sort((a, b) => (b.lastWriteAt || "").localeCompare(a.lastWriteAt || ""))[0];
if (!current?.file || !fs.existsSync(current.file)) {
  console.log("(no current conversation file found — start a session first)");
  process.exit(0);
}

const text = fs.readFileSync(current.file, "utf8");
const { meta, body } = parseFrontmatter(text);
// Use last ~3000 chars (recent turns) + tags as the query signal.
const recentBody = body.slice(-3000);
const queryTags = (meta.tags || []).map(t => String(t).toLowerCase());

const hits = retrieve(recentBody, { limit: 8, includeConversations: false, queryTags })
  .filter(h => h.note.file !== current.file);

if (hits.length === 0) {
  console.log("No related notes found in your vault yet. Build more lessons + topics, then retry.");
  process.exit(0);
}

console.log(`Recall — for current session (${meta.project || "?"}):\n`);
const qToks = tokens(recentBody).slice(0, 50);
hits.slice(0, 5).forEach((h, i) => {
  console.log(`  [${i + 1}] ${h.note.rel}  (score ${h.score.toFixed(2)}, tags ${h.note.tags.slice(0, 3).join(" ")})`);
  console.log(`      ${noteSnippet(h.note, qToks, 180)}`);
  console.log("");
});
