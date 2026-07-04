#!/usr/bin/env node
// sb-vault-repair — one-time repair of a vault polluted by early backfill runs.
// Fixes, in order: (1) purge sb's own self-capture + empty sessions,
// (2) merge trivial throwaway scopes into _unsorted, (3) delete empty scope
// folders in both mirrors, (4) rename <uuid>__untitled.md → YYYY-MM-DD--<sid8>.md,
// (5) wire linkage (auto-tags + project-INDEX backlinks + Related).
//
// Idempotent. Default is DRY-RUN; pass --apply to execute.
// Usage: sb-vault-repair.js [--apply]

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "lib");
const { VAULT, DIR, paths, ensureDirs, readSessionMap, writeSessionMap } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { SELF_CAPTURE_SIGNATURES, inScratch, noteFileName, wireLinks } = require(path.join(SKILL_LIB, "import-helpers.js"));
const { rebuildTagsIndex } = require(path.join(SKILL_LIB, "tagger.js"));

const APPLY = process.argv.includes("--apply");
const tag = APPLY ? "[APPLY]" : "[DRY-RUN]";

const CONV_ROOT = path.join(VAULT, DIR.conversations); // 01_Conversations
const PROJ_ROOT = path.join(VAULT, DIR.projects);       // 02_Projects
const UNSORTED = "_unsorted";
// Populated throwaway scopes to fold into _unsorted (empty ones just get deleted).
const MERGE_SCOPES = new Set(["github", "downloads", "claude", "tmp", "temp", "clones"]);

console.log(`${tag} sb-vault-repair → ${VAULT}\n`);

// ---------- scan every conversation note ----------
function listNotes(scopeDir) {
  if (!fs.existsSync(scopeDir)) return [];
  return fs.readdirSync(scopeDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(scopeDir, f));
}

const scopes = fs.existsSync(CONV_ROOT)
  ? fs.readdirSync(CONV_ROOT).filter((d) => fs.statSync(path.join(CONV_ROOT, d)).isDirectory())
  : [];

const purge = [];   // {file, reason}
const move = [];     // {file, fromScope, toScope, newName}
const keep = [];     // {file (final path), scope}

function isSelfCaptureNote(content, meta) {
  const head = content.slice(0, 1200);
  if (SELF_CAPTURE_SIGNATURES.some((s) => head.includes(s))) return true;
  if (inScratch(meta.project_path) && Number(meta.turn_count || 0) <= 2) return true;
  return false;
}

const usedNames = {}; // toScope -> Set(names) for collision guard

for (const scope of scopes) {
  const dir = path.join(CONV_ROOT, scope);
  for (const file of listNotes(dir)) {
    const content = fs.readFileSync(file, "utf8");
    const { meta } = parseFrontmatter(content);
    const turns = Number(meta.turn_count || 0);

    if (turns < 2) { purge.push({ file, reason: `turn_count=${turns}` }); continue; }
    if (isSelfCaptureNote(content, meta)) { purge.push({ file, reason: "self-capture" }); continue; }

    const sid = meta.session_id || path.basename(file).split("__")[0].split("--").pop().replace(/\.md$/, "");
    const toScope = MERGE_SCOPES.has(scope) ? UNSORTED : scope;
    let newName = noteFileName(sid, meta.started_at, null);

    const set = (usedNames[toScope] ||= new Set());
    if (set.has(newName)) {
      const stem = newName.replace(/\.md$/, "");
      let i = 2;
      while (set.has(`${stem}-${i}.md`)) i++;
      newName = `${stem}-${i}.md`;
    }
    set.add(newName);

    const finalPath = path.join(CONV_ROOT, toScope, newName);
    if (toScope !== scope || newName !== path.basename(file)) {
      move.push({ file, fromScope: scope, toScope, newName, finalPath, sid, meta });
    }
    keep.push({ file: finalPath, scope: toScope });
  }
}

// ---------- empty scope folders (both mirrors) ----------
// A scope becomes empty once its purged/moved notes are gone. Recompute post-plan.
function scopeSurvivors(scope) {
  return keep.filter((k) => k.scope === scope).length +
         move.filter((m) => m.toScope === scope).length -
         move.filter((m) => m.fromScope === scope).length;
}
const emptyConvScopes = scopes.filter((s) => {
  const before = listNotes(path.join(CONV_ROOT, s)).length;
  const purgedHere = purge.filter((p) => path.dirname(p.file) === path.join(CONV_ROOT, s)).length;
  const movedOut = move.filter((m) => m.fromScope === s).length;
  const movedIn = move.filter((m) => m.toScope === s).length;
  return before - purgedHere - movedOut + movedIn === 0;
});
// A project scope is safe to delete ONLY if it has no surviving conversations
// AND holds no real user content — real = any plans/ or tasks/ file, a kanban
// card (`- [`), a lessons entry (`## `), or any .md beyond the 3 scaffold files.
function projectHasRealContent(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of files) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if ((e.name === "plans" || e.name === "tasks") && fs.readdirSync(full).length > 0) return true;
      if (projectHasRealContent(full)) return true;
      continue;
    }
    if (e.name === "INDEX.md") continue;
    if (e.name === "kanban.md") {
      if (fs.readFileSync(full, "utf8").includes("- [")) return true;
      continue;
    }
    if (e.name === "lessons.md") {
      if (/^##\s/m.test(fs.readFileSync(full, "utf8"))) return true;
      continue;
    }
    return true; // any other file counts as content
  }
  return false;
}
const emptyProjScopes = fs.existsSync(PROJ_ROOT)
  ? fs.readdirSync(PROJ_ROOT).filter((d) => {
      const p = path.join(PROJ_ROOT, d);
      if (!fs.statSync(p).isDirectory()) return false;
      const hasConv = fs.existsSync(path.join(CONV_ROOT, d)) && !emptyConvScopes.includes(d);
      return !hasConv && !projectHasRealContent(p);
    })
  : [];

// ---------- report ----------
console.log(`Scanned ${scopes.length} scopes.`);
console.log(`  purge:   ${purge.length}  (self-capture + turn_count<2)`);
console.log(`  move:    ${move.length}   (rename / merge → _unsorted)`);
console.log(`  keep:    ${keep.length}`);
console.log(`  empty conversation scopes to delete: ${emptyConvScopes.length}`);
console.log(`  empty project scopes to delete:      ${emptyProjScopes.length}`);
console.log("");
console.log("Sample purge:  " + purge.slice(0, 3).map((p) => `${path.basename(path.dirname(p.file))}/${path.basename(p.file)} (${p.reason})`).join(", "));
console.log("Sample move:   " + move.slice(0, 3).map((m) => `${m.fromScope}/${path.basename(m.file)} → ${m.toScope}/${m.newName}`).join(", "));
console.log("Merge scopes → _unsorted: " + [...MERGE_SCOPES].join(", "));
console.log("");
if (process.argv.includes("--list")) {
  console.log("Empty CONVERSATION scopes to delete:\n  " + emptyConvScopes.join(" "));
  console.log("Empty PROJECT scopes to delete:\n  " + emptyProjScopes.join(" "));
  console.log("Surviving scopes (kept):\n  " + [...new Set(keep.map((k) => k.scope))].sort().join(" "));
  console.log("");
}

if (!APPLY) {
  console.log(`Snapshot before applying:  cp -r "${VAULT}" "${VAULT}.bak"`);
  console.log(`Then re-run with --apply to execute.`);
  process.exit(0);
}

// ---------- apply ----------
console.log("--- APPLYING ---");
const map = readSessionMap();
const sidByOldPath = {};
for (const [sid, e] of Object.entries(map)) if (e && e.file) sidByOldPath[path.resolve(e.file)] = sid;

let nPurge = 0, nMove = 0;
for (const { file } of purge) {
  const sid = sidByOldPath[path.resolve(file)];
  if (sid) delete map[sid];
  fs.rmSync(file, { force: true });
  nPurge++;
}
for (const m of move) {
  ensureDirs(m.toScope); // guarantees 01/02 scope dirs + INDEX scaffold
  fs.mkdirSync(path.dirname(m.finalPath), { recursive: true });
  fs.renameSync(m.file, m.finalPath);
  const sid = m.meta.session_id || sidByOldPath[path.resolve(m.file)];
  if (sid && map[sid]) { map[sid].file = m.finalPath; map[sid].project = m.toScope; }
  // keep frontmatter project field in sync when merged
  if (m.toScope !== m.fromScope) {
    const c = fs.readFileSync(m.finalPath, "utf8").replace(/^project:.*$/m, `project: ${m.toScope}`);
    fs.writeFileSync(m.finalPath, c);
  }
  nMove++;
}
writeSessionMap(map);
console.log(`  purged ${nPurge}, moved/renamed ${nMove}`);

// delete empty scope folders (recursive rm — they hold only empty scaffold)
let nDel = 0;
for (const s of emptyConvScopes) { fs.rmSync(path.join(CONV_ROOT, s), { recursive: true, force: true }); nDel++; }
for (const s of emptyProjScopes) { fs.rmSync(path.join(PROJ_ROOT, s), { recursive: true, force: true }); nDel++; }
console.log(`  deleted ${nDel} empty scope folders (both mirrors)`);

// ---------- linkage pass (load once, score in-memory: O(n^2) math, O(n) I/O) ----------
console.log("  wiring linkage (tags + INDEX backlinks + Related)…");
const notes = keep.map((k) => k.file).filter((f) => fs.existsSync(f)).map((f) => {
  const { meta, body } = parseFrontmatter(fs.readFileSync(f, "utf8"));
  return { file: f, scope: path.basename(path.dirname(f)), tags: new Set((meta.tags || []).map(String)), kw: keywords(body), mtime: fs.statSync(f).mtimeMs };
});
function keywords(text) {
  const counts = {};
  for (const w of String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 5)) counts[w] = (counts[w] || 0) + 1;
  return new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([w]) => w));
}
function score(a, b) {
  let s = 0;
  for (const t of a.tags) if (b.tags.has(t)) s += 1;
  for (const k of a.kw) if (b.kw.has(k)) s += 0.5;
  return s;
}
let nWired = 0;
for (const note of notes) {
  const related = notes
    .filter((o) => o.file !== note.file)
    .map((o) => ({ o, s: score(note, o) }))
    .filter((r) => r.s > 0.4)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((r) => path.basename(r.o.file, ".md"));
  const projIndex = paths(note.scope).projectIndex;
  wireLinks({ noteFile: note.file, projectIndexPath: projIndex, relatedBasenames: related });
  nWired++;
}
rebuildTagsIndex();
console.log(`  wired ${nWired} notes; rebuilt tags index.`);
console.log("\nRepair complete.");
