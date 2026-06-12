#!/usr/bin/env node
// One-shot: migrate vault from the old long-path slugging to the new basename-based slugs.
// Reads each session's `project_path` from frontmatter, computes the new slug, and:
//   - moves conversations/<old-slug>/file.md → conversations/<new-slug>/file.md
//   - merges projects/<old-slug>/{INDEX,kanban,lessons,plans/}  into projects/<new-slug>/
//   - updates frontmatter `project` field on every affected conversation
//   - updates session-map.json `project` field on every affected entry
// Dry-run by default; pass --apply.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, paths, projectSlugFromCwd, readSessionMap, writeSessionMap } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter, fm, updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const APPLY = process.argv.includes("--apply");
const action = APPLY ? "[APPLY]" : "[DRY-RUN]";

console.log(`${action} sb-migrate-slugs\n`);

// 1. Build mapping: old-slug → new-slug, by reading project_path from each conversation.
const map = readSessionMap();
const slugMap = new Map();        // old → new
for (const [sid, entry] of Object.entries(map)) {
  if (!entry.project_path && entry.file && fs.existsSync(entry.file)) {
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(entry.file, "utf8"));
      entry.project_path = meta.project_path;
    } catch {}
  }
  if (!entry.project_path) continue;
  const newSlug = projectSlugFromCwd(entry.project_path);
  if (entry.project && entry.project !== newSlug) {
    slugMap.set(entry.project, newSlug);
  }
}

if (slugMap.size === 0) {
  console.log("No slugs need migration. ✓");
  process.exit(0);
}

console.log(`Slug remap (${slugMap.size}):`);
for (const [oldS, newS] of slugMap) console.log(`  ${oldS}\n    → ${newS}`);

// 2. For each remap, move directories.
function moveTree(oldDir, newDir) {
  if (!fs.existsSync(oldDir)) return;
  fs.mkdirSync(newDir, { recursive: true });
  for (const entry of fs.readdirSync(oldDir, { withFileTypes: true })) {
    const src = path.join(oldDir, entry.name);
    const dst = path.join(newDir, entry.name);
    if (entry.isDirectory()) {
      moveTree(src, dst);
    } else if (fs.existsSync(dst)) {
      // Conflict: keep both, suffix new file
      const base = path.basename(entry.name, ".md");
      const ext = path.extname(entry.name);
      let i = 1;
      let alt;
      do { alt = path.join(newDir, `${base}__${i}${ext}`); i++; } while (fs.existsSync(alt));
      fs.renameSync(src, alt);
    } else {
      fs.renameSync(src, dst);
    }
  }
  try { fs.rmdirSync(oldDir); } catch {}
}

let movedConv = 0, movedProj = 0;
for (const [oldS, newS] of slugMap) {
  const oldConv = path.join(VAULT, "conversations", oldS);
  const newConv = path.join(VAULT, "conversations", newS);
  if (fs.existsSync(oldConv)) {
    console.log(`\n  conversations/${oldS}/ → conversations/${newS}/`);
    if (APPLY) { moveTree(oldConv, newConv); movedConv++; }
  }
  const oldProj = path.join(VAULT, "projects", oldS);
  const newProj = path.join(VAULT, "projects", newS);
  if (fs.existsSync(oldProj)) {
    console.log(`  projects/${oldS}/ → projects/${newS}/`);
    if (APPLY) { moveTree(oldProj, newProj); movedProj++; }
  }
}

if (!APPLY) {
  console.log(`\nDry-run complete. Re-run with --apply.`);
  process.exit(0);
}

// 3. Update frontmatter on every conversation file and rewrite session-map.
let frontUpdated = 0;
for (const [sid, entry] of Object.entries(map)) {
  if (slugMap.has(entry.project)) {
    const newSlug = slugMap.get(entry.project);
    // Update file path
    if (entry.file) {
      entry.file = entry.file.replace(`/conversations/${entry.project}/`, `/conversations/${newSlug}/`);
    }
    entry.project = newSlug;

    if (entry.file && fs.existsSync(entry.file)) {
      updateFrontmatter(entry.file, { project: newSlug });
      frontUpdated++;
    }
  }
}
writeSessionMap(map);

console.log(`\nMigration complete:`);
console.log(`  Conversation dirs moved: ${movedConv}`);
console.log(`  Project dirs moved:      ${movedProj}`);
console.log(`  Frontmatter updates:     ${frontUpdated}`);
console.log(`  Session-map entries:     ${Object.keys(map).length} (refreshed)`);
