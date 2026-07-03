// repo-artifacts.js — read per-repo knowledge artifacts for mirroring into the vault.
//
// Two code_assist skills write in-repo state that the second brain should hold:
//   - journals:     <repo>/.journal/M<phase>.md   (+ TEMPLATE.md, skipped)
//   - code reviews: <repo>/.code_review/**/*.md    (issues/history/learning/architecture_map;
//                                                    fullstack -> per-stack subfolders + SUMMARY.md)
// This module only READS the repo (never writes to it). sync-project.js mirrors the
// results into 02_Projects/<slug>/{journal,reviews}/ as AI-first notes.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// Resolve the git repo root for a directory. Uses `git rev-parse`; falls back to
// walking up for a `.git` entry. Returns null if not inside a repo.
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

// Read code-review state files (recursively, to cover fullstack subfolders).
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
          out.push({
            rel: path.relative(dir, full),
            name: e.name,
            content: fs.readFileSync(full, "utf8"),
          });
        } catch {}
      }
    }
  })(dir);
  return out;
}

// Parse the active-issue tracker (code_review_issues.md) into structured issues.
// The code_assist format uses IDs like ISSUE-001 with a severity/priority nearby.
// Best-effort line scan — returns [{ id, severity, title }].
function parseIssues(text) {
  if (!text) return [];
  const out = [];
  const lines = String(text).split("\n");
  const idRe = /\b(ISSUE-\d+)\b/;
  const sevRe = /\b(P0|P1|P2|P3|critical|high|medium|low)\b/i;
  for (const line of lines) {
    // Only count ACTIVE issues — stop at the "Resolved" section (resolved issues
    // still carry ISSUE-NNN ids but must not inflate the open count).
    if (/^#{1,6}\s*resolved\b/i.test(line.trim())) break;
    const idm = line.match(idRe);
    if (!idm) continue;
    const sev = (line.match(sevRe) || [])[1] || "";
    const title = line
      .replace(idRe, "")
      .replace(/^[\s|#>*\-]+/, "")
      .replace(/\s*\|\s*/g, " ")
      .trim()
      .slice(0, 160);
    out.push({ id: idm[1], severity: normalizeSev(sev), title });
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

// Convenience: read everything for a repo root.
function readRepoArtifacts(root) {
  const reviews = readReviews(root);
  const issuesFile = reviews.find((r) => /code_review_issues\.md$/.test(r.name));
  return {
    journals: readJournals(root),
    reviews,
    issues: issuesFile ? parseIssues(issuesFile.content) : [],
    hasGraph: fs.existsSync(path.join(root, "graphify-out", "graph.json")),
  };
}

module.exports = { repoRoot, readJournals, readReviews, parseIssues, readRepoArtifacts };
