#!/usr/bin/env node
// sb-migrate-folders — Phase 9 migration: flat layout → numbered layout.
// Idempotent. Detects pre-migration state by presence of a flat dir AND absence of its numbered twin.
// Run with --apply to actually move; default is dry-run.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT } = require(path.join(SKILL_LIB, "vault.js"));

const APPLY = process.argv.includes("--apply");
const action = APPLY ? "[APPLY]" : "[DRY-RUN]";

// flat → numbered. Special: tasks (per-project) need restructuring; we handle below.
const RENAMES = [
  ["conversations", "01_Conversations"],
  ["projects",      "02_Projects"],
  ["lessons",       "03_Lessons"],
  ["topics",        "04_Topics"],
  ["connections",   "06_Connections"],
  ["reviews",       "07_Reviews"],
  ["exports",       "09_Exports"],
  ["inbox",         "99_Inbox"],
  ["templates",     "_templates"],
];

console.log(`${action} sb-migrate-folders → ${VAULT}\n`);

const planned = [];      // [oldDir, newDir, mode]   mode: "rename" | "merge"
for (const [oldName, newName] of RENAMES) {
  const oldDir = path.join(VAULT, oldName);
  const newDir = path.join(VAULT, newName);
  if (!fs.existsSync(oldDir)) continue;
  if (fs.existsSync(newDir)) {
    const targetEmpty = fs.readdirSync(newDir).length === 0;
    if (targetEmpty) {
      planned.push([oldDir, newDir, "rename-replace"]);
      console.log(`  merge ${oldName}/ → ${newName}/  (target empty, will replace)`);
    } else {
      planned.push([oldDir, newDir, "merge"]);
      console.log(`  merge ${oldName}/ children → ${newName}/`);
    }
  } else {
    planned.push([oldDir, newDir, "rename"]);
    console.log(`  move ${oldName}/ → ${newName}/`);
  }
}

// Handle flat tasks/<slug>/*.md → 02_Projects/<slug>/tasks/*.md
// Skip the global 05_Tasks/ INDEX.md scaffold which lives at the new location.
const oldTasks = path.join(VAULT, "tasks");
const tasksMoves = [];
if (fs.existsSync(oldTasks) && fs.statSync(oldTasks).isDirectory()) {
  for (const slug of fs.readdirSync(oldTasks)) {
    const src = path.join(oldTasks, slug);
    if (!fs.statSync(src).isDirectory()) continue;
    const dst = path.join(VAULT, "02_Projects", slug, "tasks");
    if (fs.existsSync(dst) && fs.readdirSync(dst).length > 0) {
      console.log(`  skip tasks/${slug} → 02_Projects/${slug}/tasks  (target non-empty)`);
      continue;
    }
    tasksMoves.push([src, dst]);
    console.log(`  move tasks/${slug}/ → 02_Projects/${slug}/tasks/`);
  }
}

// Ensure new dirs that don't exist yet
const NEW_DIRS = ["00_Dashboard", "05_Tasks", "08_Insights", "_assets", "__scribble"];
const mkdirs = NEW_DIRS.filter(d => !fs.existsSync(path.join(VAULT, d)));
mkdirs.forEach(d => console.log(`  mkdir ${d}/`));

if (planned.length === 0 && tasksMoves.length === 0 && mkdirs.length === 0) {
  console.log("\nNothing to migrate (already in Phase 9 layout).");
  process.exit(0);
}

if (!APPLY) {
  console.log(`\n${planned.length + tasksMoves.length + mkdirs.length} actions pending. Re-run with --apply to execute.`);
  process.exit(0);
}

console.log("\n--- APPLYING ---");
for (const d of mkdirs) {
  fs.mkdirSync(path.join(VAULT, d), { recursive: true });
}
for (const [src, dst, mode] of planned) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (mode === "rename") {
    fs.renameSync(src, dst);
  } else if (mode === "rename-replace") {
    fs.rmdirSync(dst);          // empty
    fs.renameSync(src, dst);
  } else { // merge
    mergeDir(src, dst);
    if (fs.readdirSync(src).length === 0) fs.rmdirSync(src);
  }
  console.log(`  ✓ ${path.relative(VAULT, src)} → ${path.relative(VAULT, dst)}  [${mode}]`);
}
for (const [src, dst] of tasksMoves) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (fs.existsSync(dst)) fs.rmdirSync(dst); // empty per check above
  fs.renameSync(src, dst);
  console.log(`  ✓ ${path.relative(VAULT, src)} → ${path.relative(VAULT, dst)}`);
}

function mergeDir(src, dst) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (!fs.existsSync(d)) {
      fs.renameSync(s, d);
    } else if (entry.isDirectory()) {
      mergeDir(s, d);
      try { if (fs.readdirSync(s).length === 0) fs.rmdirSync(s); } catch {}
    } else {
      console.log(`    ! conflict: ${path.relative(VAULT, d)} exists; left source at ${path.relative(VAULT, s)}`);
    }
  }
}
// Clean up empty old tasks/ root
if (fs.existsSync(oldTasks)) {
  try {
    if (fs.readdirSync(oldTasks).length === 0) fs.rmdirSync(oldTasks);
  } catch {}
}

console.log("\nMigration complete.");
