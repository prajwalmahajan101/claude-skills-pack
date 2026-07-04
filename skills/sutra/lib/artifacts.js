// artifacts.js — sutra's interchange parser for member-produced repo artifacts.
//
// This is the FORWARD bridge: code_assist writes durable engineering artifacts in
// the repo (.journal/, .code_review/, docs/adr/); sutra parses them here and builds
// a vault-ingest payload that sb's generic ingest primitive consumes. The members
// never read each other's output — sutra owns this seam.
//
// Ported from sb/lib/repo-artifacts.js (which loses its code_assist awareness in the
// standalone split) + the mapping logic that used to live in sb sync-project.js.
// Read-only on the repo. Governed by schema/{journal,adr,review}.spec.md.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// Resolve the git repo root for a directory; fall back to walking up for `.git`.
// Returns null if not inside a repo.
function repoRoot(cwd) {
  try {
    const out = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {}
  let dir = path.resolve(cwd);
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Read journal entries. Returns [{ phase, name, content }] (TEMPLATE.md excluded).
function readJournals(root) {
  const dir = path.join(root, ".journal");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "TEMPLATE.md") continue;
    try {
      out.push({
        phase: f.replace(/^M/, "").replace(/\.md$/, ""),
        name: f,
        content: fs.readFileSync(path.join(dir, f), "utf8"),
      });
    } catch {}
  }
  return out;
}

// Read code-review state files recursively (covers fullstack subfolders).
// Returns [{ rel, name, content }] where rel is relative to .code_review/.
function readReviews(root) {
  const dir = path.join(root, ".code_review");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) rec(full);
      else if (e.name.endsWith(".md")) {
        try {
          out.push({ rel: path.relative(dir, full), name: e.name, content: fs.readFileSync(full, "utf8") });
        } catch {}
      }
    }
  })(dir);
  return out;
}

// Read ADRs. Returns [{ num, name, title, content }] (template/index excluded).
function readAdrs(root) {
  const dir = path.join(root, "docs", "adr");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "0000-template.md" || /^index\.md$/i.test(f)) continue;
    // Only canonical 4-digit NNNN-<slug>.md ADRs — matches schema-check's ADR_FILE
    // so the two code paths agree on what counts as an ADR.
    const m = f.match(/^(\d{4})-/);
    if (!m) continue;
    try {
      const content = fs.readFileSync(path.join(dir, f), "utf8");
      const h1 = (content.split("\n").find((l) => l.startsWith("# ")) || "").replace(/^#\s+/, "").trim();
      out.push({ num: m[1], name: f, title: h1, content });
    } catch {}
  }
  return out;
}

function normalizeSev(s) {
  const t = String(s).toLowerCase();
  if (t === "p0" || t === "critical") return "critical";
  if (t === "p1" || t === "high") return "high";
  if (t === "p2" || t === "medium") return "medium";
  if (t === "p3" || t === "low") return "low";
  return t || "unknown";
}

// Anchor id detection to the START of a line (after optional heading/list/quote
// markup) so an ISSUE id mentioned in prose ("see ISSUE-011") is NOT treated as a
// new issue header — which would fabricate a phantom issue. Matches both the block
// form (`### ISSUE-001 — title`) and the inline form (`ISSUE-001 | High | P1`).
const ISSUE_ID_HEAD = /^[\s>#*\-|]*?(ISSUE-\d+)\b/;
// A fenced-code delimiter (``` or ~~~, optionally indented, with an optional info
// string). Lines inside a fence are code, never issue headers.
const FENCE_RE = /^\s*(```|~~~)/;

// Collect the lines of an issue's block: everything after its header line up to the
// next issue header or the next markdown heading. Fence-aware — a `###`/`ISSUE-` that
// appears INSIDE a fenced code block does not terminate the block, so metadata after
// an embedded snippet is still found. Returns the block as a single string.
function issueBlock(lines, startIdx) {
  const block = [];
  let inFence = false;
  for (let j = startIdx + 1; j < lines.length; j++) {
    if (FENCE_RE.test(lines[j])) { inFence = !inFence; block.push(lines[j]); continue; }
    if (!inFence && (ISSUE_ID_HEAD.test(lines[j]) || /^#{1,6}\s/.test(lines[j]))) break;
    block.push(lines[j]);
  }
  return block.join("\n");
}

// Parse the active-issue tracker (code_review_issues.md) into structured issues.
// Stops at a "## Resolved" section so resolved issues do not inflate the open count.
// Handles BOTH code_assist layouts: inline (`ISSUE-001 | High | P1 | …`) and the
// block form (`### ISSUE-001 — title` with `Severity: … · Priority: …` on a
// following line). Severity is taken from the id's line, else the block below it.
// This is the SINGLE definition of "what is an issue" AND its severity/priority —
// sutra's schema-check validates conformance off this same output (via checkReviews),
// so what conformance considers a valid issue and what vault ingest records can never
// diverge (H1). Skips lines inside fenced code blocks so a `### ISSUE-999` in a snippet
// does not fabricate a phantom issue (H2). Severity and priority are taken from the id's
// line first (inline form: `ISSUE-001 | High | P1`), else its block (block form:
// `Severity: … · Priority: …`). Returns [{ id, severity, priority, title, index }]
// (priority is "" when absent; index = the header's line number).
function parseIssues(text) {
  if (!text) return [];
  const out = [];
  const lines = String(text).split("\n");
  const idRe = /\b(ISSUE-\d+)\b/; // loose — only used to strip the id from a confirmed header's title
  const sevRe = /\b(critical|high|medium|low)\b/i;
  const priRe = /\b(P[0-3])\b/i;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^#{1,6}\s*resolved\b/i.test(lines[i].trim())) break;
    const idm = lines[i].match(ISSUE_ID_HEAD);
    if (!idm) continue;
    let sev = (lines[i].match(sevRe) || [])[1] || "";
    let pri = (lines[i].match(priRe) || [])[1] || "";
    if (!sev || !pri) {
      // Scan the block (until the next issue header or heading, fence-aware) for
      // whichever of severity/priority the header line didn't already carry.
      const block = issueBlock(lines, i);
      if (!sev) { const m = block.match(sevRe); if (m) sev = m[1]; }
      if (!pri) { const m = block.match(priRe); if (m) pri = m[1]; }
    }
    const title = lines[i].replace(idRe, "").replace(/^[\s|#>*\-—]+/, "").replace(/\s*\|\s*/g, " ").trim().slice(0, 160);
    out.push({ id: idm[1], severity: normalizeSev(sev), priority: pri ? pri.toUpperCase() : "", title, index: i });
  }
  return out;
}

// Read everything for a repo root.
function readRepoArtifacts(root) {
  const reviews = readReviews(root);
  const issuesFile = reviews.find((r) => /code_review_issues\.md$/.test(r.name));
  return {
    journals: readJournals(root),
    reviews,
    adrs: readAdrs(root),
    issues: issuesFile ? parseIssues(issuesFile.content) : [],
    hasGraph: fs.existsSync(path.join(root, "graphify-out", "graph.json")),
  };
}

// Build a member-agnostic vault-ingest payload from a repo's artifacts. sb's generic
// ingest primitive consumes `notes` (write each as a project note of the given type)
// and `openIssues` (surface in the project INDEX). This carries the mapping that used
// to live inside sb sync-project.js — now owned by sutra, so sb stays code_assist-blind.
function buildVaultPayload(root, project) {
  const art = readRepoArtifacts(root);
  const safe = (s) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const notes = [];
  for (const j of art.journals) {
    notes.push({ folder: "journal", name: j.name, type: "journal", title: `Journal M${j.phase}`, content: j.content });
  }
  for (const r of art.reviews) {
    notes.push({ folder: "reviews", name: `${safe(r.rel).replace(/\.md$/, "")}.md`, type: "code-review", title: r.name, content: r.content });
  }
  for (const a of art.adrs) {
    notes.push({ folder: "decisions", name: a.name, type: "decision", title: a.title || a.name, content: a.content });
  }
  return {
    project: project || path.basename(root),
    root,
    notes,
    openIssues: art.issues,
    counts: { journals: art.journals.length, reviews: art.reviews.length, adrs: art.adrs.length, openIssues: art.issues.length },
  };
}

module.exports = { repoRoot, readJournals, readReviews, readAdrs, parseIssues, issueBlock, readRepoArtifacts, buildVaultPayload, normalizeSev };
