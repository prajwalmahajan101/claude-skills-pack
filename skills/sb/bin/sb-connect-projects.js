#!/usr/bin/env node
// sb-connect-projects — second linkage pass that connects the project-side notes
// (plans, lessons) which the conversation repair left as graph islands, and
// prunes broken [[Related]] links from conversation notes.
//
// - Registers every 02_Projects/<p>/plans/*.md under that project's INDEX.md
//   `## Plans` section as [[backlinks]] (plan basenames are unique → clean edges).
// - Gives each project lessons.md an unambiguous path-qualified backlink to its
//   own INDEX (basename "lessons"/"INDEX" collide across projects, so a plain
//   [[lessons]] link resolves ambiguously — a path link fixes that).
// - Removes Related list items whose target note no longer exists.
//
// Idempotent. Default DRY-RUN; pass --apply to write. Usage: sb-connect-projects.js [--apply]

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "lib");
const { VAULT, DIR } = require(path.join(SKILL_LIB, "vault.js"));

const APPLY = process.argv.includes("--apply");
const tag = APPLY ? "[APPLY]" : "[DRY-RUN]";
const CONV_ROOT = path.join(VAULT, DIR.conversations);
const PROJ_ROOT = path.join(VAULT, DIR.projects);
const PROJ_DIRNAME = DIR.projects; // "02_Projects"

console.log(`${tag} sb-connect-projects → ${VAULT}\n`);

// ---- set of every note basename in the vault (for broken-link detection) ----
const allBasenames = new Set();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "_assets" || e.name === "__scribble") continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".md")) allBasenames.add(e.name.replace(/\.md$/, ""));
  }
})(VAULT);

let plansWired = 0, lessonsWired = 0, indexTouched = 0, indexStubbed = 0, brokenPruned = 0, notesPruned = 0;

// ---- 1 & 2: wire plans + lessons into each project INDEX ----
for (const proj of fs.readdirSync(PROJ_ROOT)) {
  const pdir = path.join(PROJ_ROOT, proj);
  if (!fs.statSync(pdir).isDirectory()) continue;
  const indexPath = path.join(pdir, "INDEX.md");

  // Plans → INDEX "## Plans"
  const plansDir = path.join(pdir, "plans");
  const plans = fs.existsSync(plansDir)
    ? fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"))
    : [];

  // A project with plans but no INDEX (junk/dot scope never fully scaffolded)
  // gets a minimal INDEX so its plans can hang off a hub instead of floating.
  if (!fs.existsSync(indexPath)) {
    if (!plans.length) continue; // nothing to anchor
    const stub = `---\ntype: project-index\nproject: ${proj}\ntags: [project]\n---\n\n# ${proj}\n`;
    if (APPLY) fs.writeFileSync(indexPath, stub);
    indexStubbed++;
  }
  if (plans.length) {
    // On-disk index, or the just-computed stub during dry-run (not yet written).
    let idx = fs.existsSync(indexPath)
      ? fs.readFileSync(indexPath, "utf8")
      : `---\ntype: project-index\nproject: ${proj}\ntags: [project]\n---\n\n# ${proj}\n`;
    const want = plans.map((p) => `- [[${p.replace(/\.md$/, "")}]]`).filter((l) => !idx.includes(l));
    if (want.length) {
      if (/^##\s+Plans\s*$/m.test(idx)) {
        idx = idx.replace(/^(##\s+Plans\s*\n(?:```[\s\S]*?```\n)?)/m, `$1${want.join("\n")}\n`);
      } else {
        idx = idx.replace(/\s*$/, "") + `\n\n## Plans\n${want.join("\n")}\n`;
      }
      if (APPLY) fs.writeFileSync(indexPath, idx);
      plansWired += want.length;
      indexTouched++;
    }
  }

  // Lessons → unambiguous backlink to its own INDEX
  const lessonsPath = path.join(pdir, "lessons.md");
  if (fs.existsSync(lessonsPath)) {
    let c = fs.readFileSync(lessonsPath, "utf8");
    const marker = `${PROJ_DIRNAME}/${proj}/INDEX`;
    if (!c.includes(marker)) {
      const backlink = `> Project: [[${marker}|${proj}]]\n`;
      c = /^---[\s\S]*?---\n/.test(c)
        ? c.replace(/^(---[\s\S]*?---\n)/, `$1\n${backlink}`)
        : backlink + "\n" + c;
      if (APPLY) fs.writeFileSync(lessonsPath, c);
      lessonsWired++;
    }
  }
}

// ---- 3: prune broken Related links from conversation notes ----
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!e.name.endsWith(".md")) continue;
    const content = fs.readFileSync(f, "utf8");
    const lines = content.split("\n");
    let changed = false;
    const kept = lines.filter((ln) => {
      const m = ln.match(/^- \[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/);
      if (m && !allBasenames.has(m[1].trim())) { changed = true; brokenPruned++; return false; }
      return true;
    });
    if (changed) {
      let out = kept.join("\n");
      // drop a now-empty "## Related" trailer
      out = out.replace(/\n## Related\s*\n(?:\s*\n)*$/,"\n");
      if (APPLY) fs.writeFileSync(f, out);
      notesPruned++;
    }
  }
})(CONV_ROOT);

console.log(`Plans linked into INDEX:   ${plansWired}  (across ${indexTouched} projects)`);
console.log(`INDEX stubs created:       ${indexStubbed}  (projects with plans but no index)`);
console.log(`Lessons backlinked:        ${lessonsWired}`);
console.log(`Broken Related links pruned: ${brokenPruned}  (in ${notesPruned} notes)`);
console.log("");
if (!APPLY) console.log("Re-run with --apply to write.");
else console.log("Done.");
