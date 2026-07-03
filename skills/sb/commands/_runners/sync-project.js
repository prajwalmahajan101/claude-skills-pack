#!/usr/bin/env node
// sync-project.js — mirror a repo's in-repo knowledge artifacts into the vault.
// Usage: sync-project.js [--project <slug>] [--repo <path>] [--all]
//
// Pulls <repo>/.journal/M*.md and <repo>/.code_review/**/*.md into
// 02_Projects/<slug>/{journal,reviews}/ as AI-first notes, and surfaces the open
// code-review issue count into the project INDEX.md. Read-only on the repo side —
// it never writes back to .journal or .code_review.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, DIR, paths, ensureDirs, projectSlugFromCwd, readSessionMap, readJSON } = require(path.join(SKILL_LIB, "vault.js"));
const { fm, parseFrontmatter, updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock } = require(path.join(SKILL_LIB, "ai-first.js"));
const { repoRoot, readRepoArtifacts } = require(path.join(SKILL_LIB, "repo-artifacts.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const opts = parseFlags(process.argv.slice(2));

const targets = opts.all ? discoverRepos() : [resolveSingle()];
let totalJournals = 0, totalReviews = 0, syncedProjects = 0;

for (const t of targets.filter(Boolean)) {
  const r = syncRepo(t.root, t.slug);
  if (r) { totalJournals += r.journals; totalReviews += r.reviews; syncedProjects++; }
}

if (syncedProjects === 0) {
  console.error("No repo with .journal/ or .code_review/ found. Run from inside a repo, or pass --repo <path>.");
  process.exit(1);
}
console.log(`Synced ${syncedProjects} project(s): ${totalJournals} journal(s), ${totalReviews} review file(s).`);
logActivity(`sync-project: ${syncedProjects} project(s), ${totalJournals} journal(s), ${totalReviews} review(s).`);

// ---------------------------------------------------------------------------

function syncRepo(root, slug) {
  const art = readRepoArtifacts(root);
  if (!art.journals.length && !art.reviews.length) return null;
  const p = ensureDirs(slug);
  const journalDir = path.join(p.project, "journal");
  const reviewDir = path.join(p.project, "reviews");
  fs.mkdirSync(journalDir, { recursive: true });
  fs.mkdirSync(reviewDir, { recursive: true });

  for (const j of art.journals) {
    const front = fm({
      type: "journal",
      project: slug,
      phase: j.phase,
      date: new Date().toISOString().slice(0, 10),
      source_repo: root,
      tags: ["journal", `project/${slug}`],
      "ai-first": true,
    });
    const body = preambleBlock(`Phase ${j.phase} journal for ${slug}, mirrored from ${path.join(root, ".journal", j.name)}. What shipped, decisions, and risks for this phase.`) +
      "\n" + stripFrontmatter(j.content) + "\n";
    fs.writeFileSync(path.join(journalDir, j.name), front + body);
  }

  for (const rv of art.reviews) {
    const safe = rv.rel.replace(/[\\/]/g, "__");
    const front = fm({
      type: "code-review",
      project: slug,
      review_file: rv.rel,
      date: new Date().toISOString().slice(0, 10),
      source_repo: root,
      tags: ["code-review", `project/${slug}`],
      "ai-first": true,
    });
    const body = preambleBlock(`Code-review state (${rv.rel}) for ${slug}, mirrored from ${root}/.code_review/. Read for standing issues, score history, and the architecture map.`) +
      "\n" + stripFrontmatter(rv.content) + "\n";
    fs.writeFileSync(path.join(reviewDir, safe.replace(/\.md$/, "") + ".md"), front + body);
  }

  updateIndexIssues(p.projectIndex, slug, art.issues, root);
  console.log(`  ${slug}: ${art.journals.length} journal(s), ${art.reviews.length} review(s), ${art.issues.length} open issue(s)`);
  return { journals: art.journals.length, reviews: art.reviews.length };
}

// Insert/refresh an "## Open review issues" section in the project INDEX.
function updateIndexIssues(indexFile, slug, issues, root) {
  if (!fs.existsSync(indexFile)) {
    // Write a minimal INDEX stub so the issues section has a home (the
    // session-start hook normally creates the full INDEX).
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, `---\ntype: project-index\nproject: ${slug}\ntags: [project]\n---\n\n# ${slug}\n`);
  }
  let text = fs.readFileSync(indexFile, "utf8");
  const bySev = issues.reduce((a, i) => ((a[i.severity] = (a[i.severity] || 0) + 1), a), {});
  const summary = Object.entries(bySev).map(([s, n]) => `${n} ${s}`).join(", ") || "none";
  const lines = [
    "## Open review issues",
    "",
    `_As of ${new Date().toISOString().slice(0, 10)} — ${issues.length} open (${summary}). Source: \`${path.relative(os.homedir(), root)}/.code_review\`._`,
    "",
    ...issues.slice(0, 15).map((i) => `- **${i.id}** (${i.severity}) ${i.title}`.trim()),
    "",
  ];
  const block = lines.join("\n");
  const re = /## Open review issues[\s\S]*?(?=\n## |\n?$)/;
  text = re.test(text) ? text.replace(re, block) : text.replace(/\s*$/, "") + "\n\n" + block;
  fs.writeFileSync(indexFile, text);
}

function resolveSingle() {
  const repo = opts.repo || repoRoot(process.cwd());
  if (!repo) return null;
  const slug = opts.project || projectSlugFromCwd(repo);
  return { root: repo, slug };
}

// Discover repos from session-map project paths + project-aliases.
function discoverRepos() {
  const seen = new Map();
  const map = readSessionMap();
  for (const e of Object.values(map)) {
    if (e.project && e.project_path) tryAdd(seen, e.project_path, e.project);
  }
  const aliasFile = path.join(VAULT, DIR.meta, "project-aliases.json");
  const aliases = readJSON(aliasFile, {});
  for (const [cwd, slug] of Object.entries(aliases)) tryAdd(seen, cwd, slug);
  return [...seen.values()];
}

function tryAdd(seen, cwd, slug) {
  const root = repoRoot(cwd);
  if (root && !seen.has(root)) seen.set(root, { root, slug });
}

function stripFrontmatter(content) {
  return content.startsWith("---\n") ? parseFrontmatter(content).body.replace(/^\s+/, "") : content;
}

function parseFlags(arr) {
  const out = { _: [] };
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a === "--all") out.all = true;
    else if (a === "--project") out.project = arr[++i];
    else if (a === "--repo") out.repo = arr[++i];
    else out._.push(a);
  }
  return out;
}
