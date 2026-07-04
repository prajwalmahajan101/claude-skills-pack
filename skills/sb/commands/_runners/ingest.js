#!/usr/bin/env node
// ingest.js — write a supplied set of notes into the vault. GENERIC and
// skill-agnostic: it does not read any repo or know what produced the notes.
// It consumes a JSON payload (from stdin or --payload <file>) and writes each
// note as a typed project note, optionally refreshing an open-issues section.
//
// This is the vault-ingest primitive the sutra orchestrator drives after it
// parses a repo's artifacts. sb stays standalone: it holds knowledge handed to
// it, with no awareness of what produced the notes or their original format.
//
// Payload shape:
//   { "project": "<slug>",
//     "notes": [ { "folder": "journal", "name": "M1.md", "type": "journal",
//                  "title": "…", "content": "…", "source": "…"? } ],
//     "openIssues": [ { "id": "ISSUE-001", "severity": "high", "title": "…" } ] }
//
// Usage: ingest.js [--payload <file>]      (reads stdin when --payload is absent)

const fs = require("node:fs");
const path = require("node:path");

// Resolve the skill's lib relative to this file, not to a fixed ~/.claude path.
// Installed, commands/_runners/../../lib is exactly ~/.claude/skills/sb/lib, so
// this is a superset of the other runners' os.homedir() pattern — it additionally
// works from an in-repo checkout, which the sutra payload↔ingest contract test
// depends on. (The sibling runners still use the homedir form; harmless drift.)
const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { ensureDirs } = require(path.join(SKILL_LIB, "vault.js"));
const { fm, parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock } = require(path.join(SKILL_LIB, "ai-first.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const opts = parseFlags(process.argv.slice(2));

const raw = opts.payload ? fs.readFileSync(opts.payload, "utf8") : fs.readFileSync(0, "utf8");
let payload;
try { payload = JSON.parse(raw); } catch (e) { fail(`invalid payload JSON: ${e.message}`); }
if (!payload || !payload.project) fail("payload must include a `project` slug");

const slug = payload.project;
const notes = Array.isArray(payload.notes) ? payload.notes : [];
const openIssues = Array.isArray(payload.openIssues) ? payload.openIssues : [];

const p = ensureDirs(slug);
const today = new Date().toISOString().slice(0, 10);
let written = 0;

for (const n of notes) {
  if (!n || !n.name || !n.content) continue;
  const folder = safeSeg(n.folder || "notes");
  const dir = path.join(p.project, folder);
  fs.mkdirSync(dir, { recursive: true });
  const front = fm({
    type: n.type || "note",
    project: slug,
    date: today,
    ...(n.source ? { source: n.source } : {}),
    tags: [n.type || "note", `project/${slug}`],
    "ai-first": true,
  });
  const body = preambleBlock(n.title || `${n.type || "note"} for ${slug}`) + "\n" + stripFrontmatter(n.content) + "\n";
  fs.writeFileSync(path.join(dir, safeName(n.name)), front + body);
  written++;
}

if (openIssues.length) updateIndexIssues(p.projectIndex, slug, openIssues);

console.log(`ingest: ${slug} — ${written} note(s), ${openIssues.length} open issue(s).`);
logActivity(`ingest: ${slug} — ${written} note(s), ${openIssues.length} open issue(s).`);

// ---------------------------------------------------------------------------

function updateIndexIssues(indexFile, slug, issues) {
  if (!fs.existsSync(indexFile)) {
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, `---\ntype: project-index\nproject: ${slug}\ntags: [project]\n---\n\n# ${slug}\n`);
  }
  let text = fs.readFileSync(indexFile, "utf8");
  const bySev = issues.reduce((a, i) => ((a[i.severity] = (a[i.severity] || 0) + 1), a), {});
  const summary = Object.entries(bySev).map(([s, n]) => `${n} ${s}`).join(", ") || "none";
  const lines = [
    "## Open review issues",
    "",
    `_As of ${today} — ${issues.length} open (${summary})._`,
    "",
    ...issues.slice(0, 15).map((i) => `- **${i.id}** (${i.severity}) ${i.title}`.trim()),
    "",
  ];
  const block = lines.join("\n");
  const re = /## Open review issues[\s\S]*?(?=\n## |\n?$)/;
  text = re.test(text) ? text.replace(re, block) : text.replace(/\s*$/, "") + "\n\n" + block;
  fs.writeFileSync(indexFile, text);
}

function stripFrontmatter(content) {
  return content.startsWith("---\n") ? parseFrontmatter(content).body.replace(/^\s+/, "") : content;
}
function safeSeg(s) { return String(s).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "notes"; }
function safeName(s) { return String(s).replace(/[\\/]+/g, "__").replace(/[^a-zA-Z0-9._-]+/g, "-") || "note.md"; }
function fail(m) { console.error(`ingest: ${m}`); process.exit(1); }
function parseFlags(arr) {
  const out = { _: [] };
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === "--payload") out.payload = arr[++i];
    else out._.push(arr[i]);
  }
  return out;
}
