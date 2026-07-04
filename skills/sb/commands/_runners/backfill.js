#!/usr/bin/env node
// Import historical session JSONLs from ~/.claude/projects/ into the vault.
// Usage: backfill.js [--days N | --all] [--dry-run]

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { ensureDirs, projectSlugFromCwd, readSessionMap, writeSessionMap, paths } = require(path.join(SKILL_LIB, "vault.js"));
const { readEvents, toTurns } = require(path.join(SKILL_LIB, "jsonl.js"));
const { fm, renderTurns, writeConversation } = require(path.join(SKILL_LIB, "markdown.js"));
const { isSelfCapture, deriveTitle, noteFileName, wireLinks } = require(path.join(SKILL_LIB, "import-helpers.js"));
const { suggest } = require(path.join(SKILL_LIB, "connector.js"));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const daysIdx = args.indexOf("--days");
const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) : (all ? Infinity : 30);
const cutoffMs = all ? 0 : Date.now() - days * 86400000;

const root = path.join(os.homedir(), ".claude", "projects");
if (!fs.existsSync(root)) { console.error("No ~/.claude/projects/"); process.exit(1); }

const map = readSessionMap();
let imported = 0, skipped = 0;

for (const projDir of fs.readdirSync(root)) {
  const full = path.join(root, projDir);
  if (!fs.statSync(full).isDirectory()) continue;
  const cwd = "/" + projDir.replace(/^-/, "").replace(/-/g, "/");
  const slug = projectSlugFromCwd(cwd);

  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith(".jsonl")) continue;
    const sid = f.replace(/\.jsonl$/, "");
    const jsonl = path.join(full, f);
    const st = fs.statSync(jsonl);
    if (st.mtimeMs < cutoffMs) { skipped++; continue; }
    if (map[sid]) { skipped++; continue; }

    const { events, size } = readEvents(jsonl, 0);
    const { metadata, turns } = toTurns(events);
    // Skip init-only / empty sessions (matches /sb:clean's turn_count<2 policy).
    if (turns.length < 2) { skipped++; continue; }

    // Never capture sb's own headless `claude -p` sub-invocations.
    if (isSelfCapture(turns, cwd)) { skipped++; continue; }

    const title = deriveTitle(turns, metadata.title);

    if (dryRun) { console.log(`DRY would import ${sid.slice(0,8)} (${turns.length} turns) → ${slug} :: ${noteFileName(sid, metadata.startedAt, st.birthtimeMs)}`); imported++; continue; }

    const p = ensureDirs(slug);
    const file = path.join(p.conversations, noteFileName(sid, metadata.startedAt, st.birthtimeMs));
    const front = {
      session_id: sid,
      title,
      project: slug,
      project_path: cwd,
      model: metadata.model || "",
      started_at: metadata.startedAt || new Date(st.birthtimeMs).toISOString(),
      last_updated: metadata.lastEventAt || new Date(st.mtimeMs).toISOString(),
      duration_minutes: metadata.startedAt && metadata.lastEventAt
        ? Math.round((new Date(metadata.lastEventAt) - new Date(metadata.startedAt)) / 60000)
        : 0,
      turn_count: turns.length,
      plans: [],
      tags: [],
      analyzed: false,
      analysis_summary: null,
      resumed_from: null,
      backfilled: true,
    };
    writeConversation(file, front, `# ${front.title}\n\n` + renderTurns(turns, 1));

    // Linkage: auto-tag, register under the project INDEX, append top-3 Related.
    const related = suggest(file, 3).map((r) => path.basename(r.note.file, ".md"));
    wireLinks({ noteFile: file, projectIndexPath: paths(slug).projectIndex, relatedBasenames: related });

    map[sid] = {
      file, project: slug, byteOffset: size,
      turnCount: turns.length, lastWriteAt: new Date().toISOString(),
    };
    imported++;
  }
}

if (!dryRun) writeSessionMap(map);
console.log(`${dryRun ? "DRY: would import" : "Imported"} ${imported}, skipped ${skipped}.`);
