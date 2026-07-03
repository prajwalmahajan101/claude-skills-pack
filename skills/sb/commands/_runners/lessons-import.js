#!/usr/bin/env node
// lessons-import.js — converge the global ~/.claude/lessons store with the vault.
// Usage: lessons-import.js [--push]
//
// Default: import every global lesson into 03_Lessons/ as an AI-first note
// (source: global-lessons). With --push: also append a pointer for each recent sb
// durable lesson back to ~/.claude/lessons/INDEX.md (the user-owned canonical store).

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { paths } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { importToVault, pushPointer, lessonsDir } = require(path.join(SKILL_LIB, "lessons-bridge.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const push = process.argv.includes("--push");

const imported = importToVault();
console.log(`Imported ${imported} global lesson(s) from ${lessonsDir()} into 03_Lessons/.`);

let pushed = 0;
if (push) {
  const P = paths("_");
  if (fs.existsSync(P.lessons)) {
    for (const f of fs.readdirSync(P.lessons)) {
      if (!f.endsWith(".md")) continue;
      try {
        const raw = fs.readFileSync(path.join(P.lessons, f), "utf8");
        const { meta } = parseFrontmatter(raw);
        // Only push sb-authored lessons (not ones we imported from global).
        if (meta.source === "global-lessons") continue;
        const slug = f.replace(/\.md$/, "");
        const titleMatch = raw.match(/^#\s+(.+)$/m);
        if (pushPointer(slug, titleMatch ? titleMatch[1].trim() : slug)) pushed++;
      } catch {}
    }
  }
  console.log(`Pushed ${pushed} sb lesson pointer(s) to ${path.join(lessonsDir(), "INDEX.md")}.`);
}

logActivity(`lessons-import: imported ${imported}${push ? `, pushed ${pushed}` : ""}.`);
