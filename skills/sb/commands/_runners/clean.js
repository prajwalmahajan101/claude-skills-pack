#!/usr/bin/env node
// /sb:clean — vault cleanup. Dry-run by default; --apply hard-deletes.
// Removes:
//   1. Conversation files with turn_count < 2 (empty/init-only sessions)
//   2. Garbage tags from all notes (invalid-shape, single-chars, brackets)
//   3. Duplicate project slugs that resolve to the same cwd in modern slugging
//   4. Stale entries in session-map.json (file missing on disk)
// Rebuilds tags.md after pruning.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, paths, readSessionMap, writeSessionMap, projectSlugFromCwd, DIR, EXCLUDE_FOLDERS, logDiag } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter, fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { mergeTags, rebuildTagsIndex } = require(path.join(SKILL_LIB, "tagger.js"));

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const MIN_TURNS = parseInt(args.find(a => a.startsWith("--min-turns="))?.split("=")[1] || "2", 10);

const action = APPLY ? "[APPLY]" : "[DRY-RUN]";
console.log(`${action} sb:clean — min-turns=${MIN_TURNS}`);

// 1. Empty conversations
const emptyFiles = [];
const convDir = path.join(VAULT, DIR.conversations);
if (fs.existsSync(convDir)) {
  walkMd(convDir, (f) => {
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(f, "utf8"));
      const tc = parseInt(meta.turn_count || 0, 10);
      if (tc < MIN_TURNS) emptyFiles.push({ f, turns: tc });
    } catch {}
  });
}
console.log(`\n[1/4] Empty conversations (turn_count < ${MIN_TURNS}): ${emptyFiles.length}`);
emptyFiles.slice(0, 20).forEach(e => console.log(`  - ${path.relative(VAULT, e.f)} (${e.turns} turns)`));
if (emptyFiles.length > 20) console.log(`  … and ${emptyFiles.length - 20} more`);

// 2. Garbage tags
let dirtyTags = 0, dirtyFiles = 0;
const tagFixes = [];
walkMd(VAULT, (f) => {
  try {
    const text = fs.readFileSync(f, "utf8");
    const { meta, body } = parseFrontmatter(text);
    const before = meta.tags || [];
    const after = mergeTags(before);
    if (before.length !== after.length || before.some(t => !after.includes(t))) {
      const dropped = before.filter(t => !after.includes(t));
      dirtyTags += dropped.length;
      dirtyFiles++;
      tagFixes.push({ f, dropped, after });
    }
  } catch {}
});
console.log(`\n[2/4] Notes with invalid tags: ${dirtyFiles} (${dirtyTags} tags would be dropped)`);
tagFixes.slice(0, 5).forEach(t => console.log(`  - ${path.relative(VAULT, t.f)}: dropping ${t.dropped.join(" ")}`));
if (tagFixes.length > 5) console.log(`  … and ${tagFixes.length - 5} more`);

// 3. Duplicate project slugs
const projectsDir = path.join(VAULT, DIR.projects);
const map = readSessionMap();
const slugByPath = {};        // canonical path → slug used historically
const dupePairs = [];
if (fs.existsSync(projectsDir)) {
  for (const slug of fs.readdirSync(projectsDir)) {
    // Try to find any session in session-map with this project to learn its project_path
    const sample = Object.values(map).find(s => s.project === slug);
    if (!sample) continue;
    const cwdLike = sample.project_path || null;
    if (!cwdLike) continue;
    const canonical = projectSlugFromCwd(cwdLike);
    if (canonical !== slug) {
      dupePairs.push({ old: slug, new: canonical });
    }
  }
}
console.log(`\n[3/4] Project slug mismatches (needs sb-migrate-slugs): ${dupePairs.length}`);
dupePairs.slice(0, 10).forEach(p => console.log(`  - ${p.old}  →  ${p.new}`));

// 4. Stale session-map entries
const stale = [];
for (const [sid, entry] of Object.entries(map)) {
  if (entry.file && !fs.existsSync(entry.file)) stale.push(sid);
}
console.log(`\n[4/4] Stale session-map entries (file missing): ${stale.length}`);
stale.slice(0, 5).forEach(s => console.log(`  - ${s.slice(0, 8)}…`));

if (!APPLY) {
  console.log(`\n${emptyFiles.length + dirtyFiles + stale.length} total changes pending. Re-run with --apply to execute.`);
  process.exit(0);
}

// APPLY
console.log(`\n--- APPLYING ---`);

let n = 0;
for (const e of emptyFiles) {
  fs.unlinkSync(e.f);
  n++;
}
console.log(`Deleted ${n} empty conversation files.`);

n = 0;
for (const t of tagFixes) {
  try {
    const text = fs.readFileSync(t.f, "utf8");
    const { meta, body } = parseFrontmatter(text);
    meta.tags = t.after;
    fs.writeFileSync(t.f, fm(meta) + body);
    n++;
  } catch (e) {
    // A skipped rewrite under --apply must not look like success — log it.
    logDiag(`clean: tag rewrite skipped for ${t.f} (${e.message})`);
  }
}
console.log(`Cleaned tags in ${n} notes.`);

// Remove stale entries from session-map
for (const sid of stale) delete map[sid];
// Also remove entries pointing at deleted empty files
for (const e of emptyFiles) {
  for (const [sid, entry] of Object.entries(map)) {
    if (entry.file === e.f) delete map[sid];
  }
}
writeSessionMap(map);
console.log(`Pruned ${stale.length} stale session-map entries.`);

const counts = rebuildTagsIndex();
console.log(`Rebuilt tags.md (${Object.keys(counts).length} unique tags remain).`);

if (dupePairs.length) {
  console.log(`\nNOTE: ${dupePairs.length} project slug mismatches need migration. Run:`);
  console.log(`  node ${path.join(os.homedir(), ".claude", "skills", "sb", "bin", "sb-migrate-slugs.js")} --apply`);
}

function walkMd(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || EXCLUDE_FOLDERS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
