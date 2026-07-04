#!/usr/bin/env node
// eval.js — measure retrieval quality of lib/retriever.js against a held-out
// question set. Usage: eval.js [--rebuild] [--sample N]
//
// Builds (once, cached in _meta/eval-set.json) a set of paraphrased questions —
// one per sampled note — where Haiku is told to AVOID the note's title words so
// the question tests semantic recall, not literal title matching. Then for each
// question it runs the lexical retriever and records the rank of the note the
// question was derived from. Reports recall@1/3/5/10 + MRR per note-type, and
// names the note that wrongly ranked #1 when the target was missed.
//
// Deterministic scoring; Haiku is only used to (re)build the question set.
// Results are cached to _meta/eval-results.json for /sb:status to surface.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, paths } = require(path.join(SKILL_LIB, "vault.js"));
const { retrieve, loadIndex } = require(path.join(SKILL_LIB, "retriever.js"));

const MODEL = process.env.SB_ANALYZER_MODEL || "claude-haiku-4-5-20251001";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";
const P = paths("_");
const EVAL_SET = path.join(P.meta, "eval-set.json");
const EVAL_RESULTS = path.join(P.meta, "eval-results.json");

const args = process.argv.slice(2);
const REBUILD = args.includes("--rebuild");
const SAMPLE = flagNum(args, "--sample", parseInt(process.env.SB_EVAL_SAMPLE || "12", 10));

// Note-types worth evaluating (high-signal, human/AI-authored — not raw convos).
const EVAL_TYPES = new Set(["lessons", "topics", "zettel", "insights", "decisions"]);

const K_VALUES = [1, 3, 5, 10];

let evalSet = loadEvalSet();
if (REBUILD || !evalSet || !evalSet.items || !evalSet.items.length) {
  evalSet = buildEvalSet();
  if (!evalSet.items.length) {
    console.error("No eligible notes to build an eval set from (need lessons/topics/zettels/insights/decisions).");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(EVAL_SET), { recursive: true });
  fs.writeFileSync(EVAL_SET, JSON.stringify(evalSet, null, 2) + "\n");
  console.log(`Built eval set: ${evalSet.items.length} question(s) → ${path.relative(VAULT, EVAL_SET)}`);
}

const results = runEval(evalSet);
fs.writeFileSync(EVAL_RESULTS, JSON.stringify(results, null, 2) + "\n");
report(results);

// ---------------------------------------------------------------------------

function loadEvalSet() {
  try { return JSON.parse(fs.readFileSync(EVAL_SET, "utf8")); } catch { return null; }
}

function buildEvalSet() {
  const notes = loadIndex().filter((n) => EVAL_TYPES.has(n.type) && n.body.trim().length > 80);
  // Deterministic sample: sort by rel, stride-pick up to SAMPLE.
  notes.sort((a, b) => a.rel.localeCompare(b.rel));
  const picked = stride(notes, SAMPLE);
  const items = [];
  for (const n of picked) {
    const q = paraphraseQuestion(n);
    if (q) items.push({ rel: n.rel, type: n.type, title: n.title, question: q });
  }
  return { built: new Date().toISOString().slice(0, 10), model: MODEL, items };
}

// Ask Haiku for one natural question the note answers, avoiding the title's words.
function paraphraseQuestion(note) {
  const titleWords = note.title.toLowerCase().match(/[a-z0-9]+/g) || [];
  const excerpt = note.body.replace(/\s+/g, " ").slice(0, 2000);
  const prompt = `A knowledge note is titled "${note.title}". Write ONE natural-language question that a person would ask whose best answer is this note. Hard rule: do NOT reuse these words from the title: ${titleWords.join(", ")}. Use different vocabulary describing the underlying problem/topic. Return ONLY the question text, one line, no quotes.

Note excerpt:
${excerpt}`;
  const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
    input: prompt, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  const line = r.stdout.trim().split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
  return line.replace(/^["']|["']$/g, "").slice(0, 300) || null;
}

function runEval(set) {
  const perType = {};
  const overall = newAgg();
  const misses = [];
  for (const item of set.items) {
    const ranked = retrieve(item.question, { limit: 10, includeConversations: false });
    const rank = ranked.findIndex((r) => r.note.rel === item.rel); // 0-based, -1 if absent
    const t = item.type;
    perType[t] = perType[t] || newAgg();
    tally(perType[t], rank);
    tally(overall, rank);
    if (rank !== 0) {
      misses.push({
        type: t, target: item.rel, question: item.question,
        rank: rank === -1 ? null : rank + 1,
        wrongTop: ranked[0] ? ranked[0].note.rel : null,
      });
    }
  }
  finalize(overall);
  for (const t of Object.keys(perType)) finalize(perType[t]);
  return {
    ranAt: new Date().toISOString(),
    n: set.items.length,
    overall, perType, misses,
    recall_at_5: overall.recall[5], // convenience for /sb:status
  };
}

function newAgg() {
  return { n: 0, hits: Object.fromEntries(K_VALUES.map((k) => [k, 0])), mrrSum: 0, recall: {}, mrr: 0 };
}
function tally(agg, rank0) {
  agg.n++;
  if (rank0 >= 0) {
    for (const k of K_VALUES) if (rank0 < k) agg.hits[k]++;
    agg.mrrSum += 1 / (rank0 + 1);
  }
}
function finalize(agg) {
  for (const k of K_VALUES) agg.recall[k] = agg.n ? round(agg.hits[k] / agg.n) : 0;
  agg.mrr = agg.n ? round(agg.mrrSum / agg.n) : 0;
}
function round(x) { return Math.round(x * 1000) / 1000; }

function report(res) {
  console.log(`\nRetrieval eval — ${res.n} question(s), ran ${res.ranAt.slice(0, 16).replace("T", " ")}`);
  console.log(`  overall: R@1 ${res.overall.recall[1]}  R@3 ${res.overall.recall[3]}  R@5 ${res.overall.recall[5]}  R@10 ${res.overall.recall[10]}  MRR ${res.overall.mrr}`);
  console.log("\n  by type:");
  for (const [t, a] of Object.entries(res.perType)) {
    console.log(`    ${t.padEnd(12)} n=${String(a.n).padStart(3)}  R@1 ${a.recall[1]}  R@3 ${a.recall[3]}  R@5 ${a.recall[5]}  R@10 ${a.recall[10]}  MRR ${a.mrr}`);
  }
  if (res.misses.length) {
    console.log(`\n  ${res.misses.length} miss(es) (target not ranked #1):`);
    for (const m of res.misses.slice(0, 15)) {
      const where = m.rank ? `#${m.rank}` : "not in top-10";
      console.log(`    - want ${m.target} (${where}); wrong #1 = ${m.wrongTop || "—"}`);
      console.log(`        q: ${m.question}`);
    }
  }
  console.log(`\n  cached → ${path.relative(VAULT, EVAL_RESULTS)}`);
}

function stride(arr, n) {
  if (arr.length <= n) return arr.slice();
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function flagNum(argv, flag, dflt) {
  const i = argv.indexOf(flag);
  if (i === -1 || i + 1 >= argv.length) return dflt;
  const v = parseInt(argv[i + 1], 10);
  return Number.isFinite(v) ? v : dflt;
}
