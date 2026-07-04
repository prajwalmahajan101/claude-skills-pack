#!/usr/bin/env node
// /sb:ask "<question>" — semantic Q&A over the vault.
// Retrieves relevant notes lexically, then invokes claude -p with them as context.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { retrieve, tokens } = require(path.join(SKILL_LIB, "retriever.js"));

const MODEL = process.env.SB_ASK_MODEL || "claude-sonnet-4-6";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";
const LIMIT = parseInt(process.env.SB_ASK_RETRIEVAL_LIMIT || "10", 10);

const args = process.argv.slice(2);
const question = args.join(" ").replace(/^["']|["']$/g, "").trim();
if (!question) { console.error('Usage: ask.js "<question>"'); process.exit(2); }

// Extract any tag filters from the question (e.g., "tag:#db/postgres")
const tagMatches = [...question.matchAll(/tag:(#[\w/-]+)/g)].map(m => m[1].toLowerCase());
const cleanQuestion = question.replace(/tag:#[\w/-]+/g, "").trim();

const hits = retrieve(cleanQuestion, { limit: LIMIT, queryTags: tagMatches });
if (hits.length === 0) {
  console.log(`No vault notes matched your question. (try /sb:search for full-text)`);
  process.exit(0);
}

console.log(`Retrieved ${hits.length} notes:`);
hits.forEach((h, i) => console.log(`  [${i + 1}] ${h.note.rel}  (score ${h.score.toFixed(2)})`));
console.log("\nAsking " + MODEL + "…\n");

const systemPrompt = `You are a personal knowledge-base oracle. The user has asked a question. You have access ONLY to the following notes from their second brain. Answer using ONLY information present in these notes.

RULES:
- Cite sources inline as Obsidian wikilinks: [[note-filename-without-extension]].
- If the notes don't contain enough information, say "Based on the vault, I don't have enough to answer fully. The closest matches are: ..." and list the most relevant notes.
- Be concise but complete. Synthesize across notes — don't just dump quotes.
- If the question is about the user's own work history (decisions, patterns), summarize the pattern with examples and dates from the notes.`;

const notesContext = hits.map((h, i) =>
  `### Note [${i + 1}]: ${h.note.rel}\n` +
  `Tags: ${h.note.tags.join(" ") || "(none)"}\n` +
  `Filename for wikilink: ${path.basename(h.note.rel, ".md")}\n\n` +
  h.note.body.slice(0, 6000) +
  (h.note.body.length > 6000 ? "\n\n[...truncated...]" : "")
).join("\n\n---\n\n");

const prompt = `${systemPrompt}\n\n=== USER QUESTION ===\n${question}\n\n=== AVAILABLE NOTES ===\n\n${notesContext}\n\n=== END NOTES ===\n\nAnswer the question now.`;

const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
  input: prompt, encoding: "utf8", maxBuffer: 100 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error(`claude -p failed: ${r.stderr || r.status}`);
  process.exit(1);
}
process.stdout.write(r.stdout);
if (!r.stdout.endsWith("\n")) process.stdout.write("\n");
