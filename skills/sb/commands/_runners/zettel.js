#!/usr/bin/env node
// zettel.js — create an atomic permanent (Zettelkasten) note.
// Usage: zettel.js "<claim title>" [--source <note>] [--body "..."] [--draft]
//
// Follows the my_vault Zettelkasten convention: a timestamp id, a claim-as-title,
// a WHAT-layer body, "Why This Matters" + "Connections", and related[]/sources[]
// frontmatter. Auto-suggests related zettels/lessons by tag overlap. --draft asks
// Haiku to expand the claim (then the note is marked verified:false).

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, DIR, paths, ensureDirs, slugify } = require(path.join(SKILL_LIB, "vault.js"));
const { fm, parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock, aiFirstFront, unverifiedFront, aiCallout } = require(path.join(SKILL_LIB, "ai-first.js"));
const { tagFile } = require(path.join(SKILL_LIB, "tagger.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const MODEL = process.env.SB_ANALYZER_MODEL || "claude-haiku-4-5-20251001";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const opts = parseFlags(process.argv.slice(2));
const title = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
if (!title) { console.error('Usage: zettel.js "<claim title>" [--source <note>] [--draft]'); process.exit(2); }

ensureDirs("_");
const P = paths("_");
fs.mkdirSync(P.zettel, { recursive: true });

const id = timestampId();
const slug = slugify(title);
const file = path.join(P.zettel, `${id}-${slug}.md`);

let bodyText = opts.body || "";
let drafted = false;
if (!bodyText && opts.draft) {
  bodyText = draftClaim(title);
  drafted = Boolean(bodyText);
}
if (!bodyText) bodyText = "TBD — state the claim in one self-contained paragraph (the WHAT).";

const related = suggestRelated(title);
const sources = opts.source ? [`[[${opts.source}]]`] : [];

const baseFront = aiFirstFront({
  type: "zettel",
  date: new Date().toISOString().slice(0, 10),
  id,
  tags: ["zettelkasten", "permanent_note"],
  related: related.map((r) => `[[${r}]]`),
  sources,
});
const front = drafted ? unverifiedFront(baseFront, MODEL) : baseFront;

const body =
  (drafted ? aiCallout(MODEL) + "\n" : "") +
  preambleBlock(`Atomic permanent note. The title is the claim; the body is the WHAT-layer explanation. Linked to ${related.length} related note(s).`) +
  `\n## ${title}\n\n${bodyText}\n\n## Why This Matters\n${opts.why || "TBD"}\n\n## Connections\n` +
  related.map((r) => `- [[${r}]]`).join("\n") + (related.length ? "\n" : "") +
  (sources.length ? `\n## Sources\n${sources.map((s) => `- ${s}`).join("\n")}\n` : "");

fs.writeFileSync(file, fm(front) + body);
tagFile(file);
console.log(`Wrote zettel: ${path.relative(VAULT, file)}`);
if (related.length) console.log(`Linked ${related.length} related note(s).`);
logActivity(`zettel: ${title}`);

// ---------------------------------------------------------------------------

function timestampId() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

// Suggest related zettels + lessons by shared title tokens (cheap, deterministic).
function suggestRelated(title) {
  const want = new Set(title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const out = [];
  for (const dir of [P.zettel, P.lessons, P.topics]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const stem = path.basename(f, ".md");
      const toks = new Set(stem.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      const overlap = [...toks].filter((t) => want.has(t)).length;
      if (overlap >= 2) out.push(stem);
    }
  }
  return [...new Set(out)].slice(0, 5);
}

function draftClaim(title) {
  const prompt = `Write the WHAT-layer body of an atomic Zettelkasten note whose claim/title is: "${title}".
One self-contained paragraph (4-6 sentences) explaining the claim plainly. No preamble, no title, no fences. State only what is well-established; if unsure, hedge explicitly.`;
  const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
    input: prompt, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
  });
  return r.status === 0 ? r.stdout.trim() : "";
}

function parseFlags(arr) {
  const out = { _: [] };
  const val = new Set(["source", "body", "why"]);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) { const k = a.slice(2); if (val.has(k)) out[k] = arr[++i]; else out[k] = true; }
    else out._.push(a);
  }
  return out;
}
