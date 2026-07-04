#!/usr/bin/env node
// distill.js — distill a note into atomic, source-anchored claims.
// Usage: distill.js <note-path-or-slug>
//
// Numbers the source note's blocks B1..Bn, asks Haiku to extract atomic claims
// each citing the block(s) it came from, then KEEPS only claims that cite a real
// block and DROPS (and reports) the rest. Writes a `type: distillation`,
// `verified: false` note into 08_Insights/ with the numbered sources preserved
// verbatim so every claim is traceable. Never invents facts; unsourced claims are
// visibly listed, not hidden.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, DIR, paths, slugify } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter, fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock, unverifiedFront, aiCallout } = require(path.join(SKILL_LIB, "ai-first.js"));
const { loadIndex } = require(path.join(SKILL_LIB, "retriever.js"));
const { numberBlocks, renderNumbered, splitClaims } = require(path.join(SKILL_LIB, "provenance.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const MODEL = process.env.SB_ANALYZER_MODEL || "claude-haiku-4-5-20251001";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const arg = process.argv.slice(2).join(" ").replace(/^["']|["']$/g, "").trim();
if (!arg) { console.error("Usage: distill.js <note-path-or-slug>"); process.exit(2); }

const src = resolveNote(arg);
if (!src) { console.error(`No note found matching "${arg}".`); process.exit(1); }

const raw = fs.readFileSync(src.file, "utf8");
const { meta, body } = parseFrontmatter(raw);
const blocks = numberBlocks(stripPreamble(body));
if (!blocks.length) { console.error("Source note has no distillable content."); process.exit(1); }

const claimLines = extractClaims(blocks);
if (!claimLines) { console.error("Claim extraction failed (is the claude CLI available?)."); process.exit(1); }
const { sourced, unsourced } = splitClaims(claimLines, blocks.map((b) => b.id));

const P = paths("_");
fs.mkdirSync(P.insights, { recursive: true });
const title = meta.title || src.title || path.basename(src.file, ".md");
const date = new Date().toISOString().slice(0, 10);
const outSlug = `distill-${slugify(title)}`;
const outFile = path.join(P.insights, `${outSlug}.md`);

const srcRel = path.relative(VAULT, src.file);
const srcStem = path.basename(src.file, ".md");
const front = unverifiedFront({
  type: "distillation",
  date,
  source_note: srcRel,
  claim_count: sourced.length,
  dropped_count: unsourced.length,
  tags: ["distillation", "insight"],
}, MODEL);

const out = [];
out.push(fm(front).trimEnd());
out.push("");
out.push(`# Distillation — ${title}`);
out.push("");
out.push(aiCallout(MODEL).trimEnd());
out.push("");
out.push(preambleBlock(`Atomic, source-anchored claims distilled from [[${srcStem}]]. Every claim cites the numbered source block it came from; unsourced claims were dropped and are listed below. Unverified — run /sb:verify once reviewed.`).trimEnd());
out.push("");
out.push(`Source: [[${srcStem}]] (\`${srcRel}\`)`);
out.push("");
out.push(`## Claims (${sourced.length})`);
if (sourced.length) {
  for (const c of sourced) out.push(`- ${c.text} (src: ${c.sources.join(", ")})`);
} else {
  out.push("_None — no claim cited a real source block._");
}
out.push("");
out.push(`## Dropped (unsourced) (${unsourced.length})`);
if (unsourced.length) {
  out.push("These claims cited no valid source block and were NOT kept:");
  for (const c of unsourced) {
    const cited = c.cited && c.cited.length ? ` [cited non-existent: ${c.cited.join(", ")}]` : "";
    out.push(`- ${c.text}${cited}`);
  }
} else {
  out.push("_None — every extracted claim was sourced._");
}
out.push("");
out.push("## Sources (verbatim)");
out.push("");
out.push(renderNumbered(blocks));
out.push("");

fs.writeFileSync(outFile, out.join("\n"));

console.log(`Wrote distillation: ${path.relative(VAULT, outFile)}`);
console.log(`  ${sourced.length} sourced claim(s), ${unsourced.length} dropped (unsourced). verified: false.`);
logActivity(`distill ${srcStem}: ${sourced.length} claims, ${unsourced.length} dropped`);

// ---------------------------------------------------------------------------

function resolveNote(a) {
  // Absolute or relative path that exists.
  const asPath = path.isAbsolute(a) ? a : path.join(VAULT, a);
  for (const cand of [a, asPath, asPath.endsWith(".md") ? asPath : asPath + ".md"]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return { file: cand, title: path.basename(cand, ".md") };
    }
  }
  // Fuzzy: match against the index by rel / stem / title.
  const needle = a.toLowerCase().replace(/\.md$/, "");
  const notes = loadIndex();
  const hit = notes.find((n) => path.basename(n.rel, ".md").toLowerCase() === needle)
    || notes.find((n) => (n.title || "").toLowerCase() === needle)
    || notes.find((n) => n.rel.toLowerCase().includes(needle));
  return hit ? { file: hit.file, title: hit.title } : null;
}

function stripPreamble(body) {
  // Drop the whole `## For future Claude` block (header + its prose, up to the
  // next heading) so the machine-summary is not distilled as source content.
  const b = String(body || "");
  const m = b.match(/^##\s+For future Claude\b/m);
  if (!m) return b.trim();
  const after = b.slice(m.index);
  const nextH = after.search(/\n#{1,6}\s/);
  if (nextH === -1) return b.slice(0, m.index).trim();
  return (b.slice(0, m.index) + after.slice(nextH + 1)).trim();
}

function extractClaims(blocks) {
  const prompt = `Below are numbered source blocks from a note. Extract the atomic factual claims. Output ONE claim per line as:
- <claim> (src: Bn)
Rules:
- Each claim must cite the block id(s) it came from, e.g. (src: B2) or (src: B1, B4).
- One idea per line; split compound sentences.
- Do NOT invent anything not present in a block. If you cannot attribute a statement to a block, do not write it.
- Output ONLY the bulleted claim lines, nothing else.

${renderNumbered(blocks)}`;
  const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
    input: prompt, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  return r.stdout.split("\n").map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l));
}
