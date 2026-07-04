#!/usr/bin/env node
// sb-session-start: scaffold project dir on first session in a cwd.

if (process.env.SB_DISABLE === "1") process.exit(0);

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(__dirname, "..", "lib");
const { ensureDirs, projectSlugFromCwd, paths, readSessionMap, writeSessionMap, markSessionEnded } = require(path.join(SKILL_LIB, "vault.js"));
const { updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

// Optional bridges to the external memory systems (best-effort; absent-safe).
let listFacts = () => [];
let recentHighlights = () => [];
try { ({ listFacts } = require(path.join(SKILL_LIB, "memory-bridge.js"))); } catch {}
try { ({ recentHighlights } = require(path.join(SKILL_LIB, "remember-bridge.js"))); } catch {}

function memoryRememberSection() {
  let facts = [], highlights = [];
  try { facts = listFacts().slice(0, 5); } catch {}
  try { highlights = recentHighlights(3); } catch {}
  if (!facts.length && !highlights.length) return "";
  const lines = ["", "## Memory & Remember", ""];
  if (facts.length) {
    lines.push("**Harness memory facts:**");
    for (const f of facts) lines.push(`- ${f.slug} — ${f.description || ""}`.trimEnd());
    lines.push("");
  }
  if (highlights.length) {
    lines.push("**Recently (from ~/.remember):**");
    for (const h of highlights) lines.push(`- ${h.slice(0, 120)}`);
    lines.push("");
  }
  return lines.join("\n");
}

const STALE_MS = 24 * 3600 * 1000;
const CLEAR_WINDOW_MS = 5 * 60 * 1000;

try { main(); } catch (e) { logErr(e); }

function main() {
  const input = readStdinSync();
  const hook = safeJSON(input);
  const cwd = hook.cwd || process.cwd();
  const newSessionId = hook.session_id || hook.sessionId;
  const slug = projectSlugFromCwd(cwd);
  const p = ensureDirs(slug);

  if (!fs.existsSync(p.projectIndex)) {
    fs.writeFileSync(p.projectIndex, projectIndexTemplate(slug, cwd));
  }
  if (!fs.existsSync(p.projectKanban)) {
    fs.writeFileSync(p.projectKanban, kanbanTemplate(slug));
  }
  if (!fs.existsSync(p.projectLessons)) {
    fs.writeFileSync(p.projectLessons, lessonsTemplate(slug));
  }

  // (1) Resurrect-stale: any active session in this project whose last write was >24h ago → crashed.
  const map = readSessionMap();
  const now = Date.now();
  for (const [sid, entry] of Object.entries(map)) {
    if (entry.project !== slug) continue;
    if (entry.status === "ended") continue;
    const last = entry.lastWriteAt ? new Date(entry.lastWriteAt).getTime() : 0;
    if (now - last > STALE_MS) {
      markSessionEnded(sid, "crashed", entry.lastWriteAt || new Date(now - STALE_MS).toISOString());
    }
  }

  // (2) Clear-chain: link new session to a recently-ended cleared predecessor.
  if (newSessionId) {
    const fresh = readSessionMap();
    let predecessor = null;
    for (const [sid, entry] of Object.entries(fresh)) {
      if (sid === newSessionId) continue;
      if (entry.project !== slug) continue;
      if (entry.endedReason !== "cleared") continue;
      if (!entry.endedAt) continue;
      const ended = new Date(entry.endedAt).getTime();
      if (now - ended > CLEAR_WINDOW_MS) continue;
      if (!predecessor || new Date(entry.endedAt) > new Date(predecessor.entry.endedAt)) {
        predecessor = { sid, entry };
      }
    }
    if (predecessor) {
      // Backlink predecessor → new
      markSessionEnded(predecessor.sid, "cleared", predecessor.entry.endedAt, { clearedTo: newSessionId });
      // Stash for sb-capture to apply `cleared_from` when it creates the new conv file.
      fresh[newSessionId] = { ...(fresh[newSessionId] || {}), clearedFrom: predecessor.sid };
      writeSessionMap(fresh);
    }
  }
}

function projectIndexTemplate(slug, cwd) {
  return `---
type: project-index
project: ${slug}
path: ${JSON.stringify(cwd)}
created: ${new Date().toISOString()}
tags: [project]
---

# ${slug}

> Auto-generated project dashboard. Edit freely; new sessions append to the linked sections.

**Path:** \`${cwd}\`

## Kanban
[[kanban]]

## Lessons (project-scoped)
[[lessons]]

## Plans
\`\`\`
ls plans/
\`\`\`

## Conversations
Stored under \`../../conversations/${slug}/\`.
${memoryRememberSection()}`;
}

function kanbanTemplate(slug) {
  return `---
type: kanban
project: ${slug}
kanban-plugin: board
tags: [kanban]
---

## To Do


## Doing


## Done

`;
}

function lessonsTemplate(slug) {
  return `---
type: project-lessons
project: ${slug}
tags: [lessons]
---

# Lessons — ${slug}

> Project-scoped lessons. Cross-cutting lessons live in \`/lessons/\`.

`;
}

function readStdinSync() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch { return ""; }
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

function logErr(e) {
  try {
    const log = path.join(os.homedir(), ".claude", "cache", "sb-session-start.log");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `${new Date().toISOString()} ERROR ${e.stack || e.message}\n`);
  } catch {}
}
