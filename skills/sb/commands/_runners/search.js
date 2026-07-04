#!/usr/bin/env node
// search.js — vault search.
//   default:      thin wrapper over `obsidian vault=<name> search query="..."`.
//   --semantic:   key-free semantic search that fuses precomputed-vector neighbours
//                 with the lexical retriever via Reciprocal Rank Fusion (report mode).
//
// Usage: search.js <query>
//        search.js --semantic <query> [--k N]
//
// Semantic path (no API key): embed the query via SB_EMBED_CMD if set, else anchor
// it to the top lexical hit's precomputed vector, take that vector's nearest
// neighbours, and RRF-fuse with the lexical ranking. If no smart-connections
// vectors exist, it degrades to plain keyword search and says so.

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, VAULT_NAME } = require(path.join(SKILL_LIB, "vault.js"));

const argv = process.argv.slice(2);
if (argv.includes("--semantic")) {
  semanticSearch(argv.filter((a) => a !== "--semantic"));
} else {
  obsidianSearch(argv);
}

// ---------------------------------------------------------------------------

function obsidianSearch(args) {
  const query = args.join(" ").trim();
  if (!query) { console.error("Usage: search.js <query>  |  search.js --semantic <query>"); process.exit(2); }
  const r = spawnSync("obsidian", [`vault=${VAULT_NAME}`, "search", `query=${query}`, "limit=20"], { encoding: "utf8" });
  if (r.error) {
    console.error("obsidian CLI not found. Make sure ~/.local/bin/obsidian exists and is in PATH.");
    console.error("(For a key-free ranked search without Obsidian, try: /sb:search --semantic <query>)");
    process.exit(1);
  }
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exit(r.status || 0);
}

function semanticSearch(args) {
  const K = flagNum(args, "--k", 10);
  const query = args.filter((a, i) => !(a === "--k") && !(args[i - 1] === "--k")).join(" ").trim();
  if (!query) { console.error("Usage: search.js --semantic <query> [--k N]"); process.exit(2); }

  const { retrieve } = require(path.join(SKILL_LIB, "retriever.js"));
  const { hasEmbeddings, loadEmbeddings, nearest, anchorVector, embedQuery } = require(path.join(SKILL_LIB, "embeddings.js"));

  const lexical = retrieve(query, { limit: Math.max(K, 20), includeConversations: true })
    .map((r) => ({ rel: r.note.rel, score: r.score }));

  if (!hasEmbeddings()) {
    console.log(`Semantic search for "${query}" — no smart-connections vectors (.smart-env/multi absent).`);
    console.log("Degrading to keyword search:\n");
    printRanked(lexical.slice(0, K));
    return;
  }

  const index = loadEmbeddings();
  let vec = embedQuery(query);
  let mode = "query-embedding (SB_EMBED_CMD)";
  let anchorRel = null;
  if (!vec) {
    const a = anchorVector(query, index);
    if (a) { vec = a.vec; anchorRel = a.rel; mode = `keyword-anchor (via ${a.rel})`; }
  }

  const semantic = vec ? nearest(vec, index, { k: Math.max(K, 20), excludeRel: anchorRel }) : [];
  const fused = rrf([lexical, semantic]);

  console.log(`Semantic search for "${query}"`);
  console.log(`  mode: ${mode}${vec ? "" : " (no vector — lexical only)"}\n`);
  printRanked(fused.slice(0, K), { lexical, semantic });
}

// Reciprocal Rank Fusion across ranked lists of { rel }.
function rrf(lists, k = 60) {
  const scores = {};
  for (const list of lists) {
    list.forEach((item, i) => {
      scores[item.rel] = (scores[item.rel] || 0) + 1 / (k + i + 1);
    });
  }
  return Object.entries(scores)
    .map(([rel, score]) => ({ rel, score }))
    .sort((a, b) => b.score - a.score);
}

function printRanked(rows, ctx) {
  if (!rows.length) { console.log("  (no results)"); return; }
  const inLex = ctx ? new Set(ctx.lexical.map((x) => x.rel)) : null;
  const inSem = ctx ? new Set(ctx.semantic.map((x) => x.rel)) : null;
  for (const r of rows) {
    let tag = "";
    if (ctx) {
      const l = inLex.has(r.rel), s = inSem.has(r.rel);
      tag = l && s ? " [lex+sem]" : s ? " [sem]" : " [lex]";
    }
    console.log(`  ${r.score.toFixed(4)}  ${r.rel}${tag}`);
  }
}

function flagNum(a, flag, dflt) {
  const i = a.indexOf(flag);
  if (i === -1 || i + 1 >= a.length) return dflt;
  const v = parseInt(a[i + 1], 10);
  return Number.isFinite(v) ? v : dflt;
}
