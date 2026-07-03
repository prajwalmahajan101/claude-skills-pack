// Vault paths, project slug derivation, session-map I/O.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const VAULT = process.env.SB_VAULT_PATH
  ? expandHome(process.env.SB_VAULT_PATH)
  : path.join(os.homedir(), "Documents", "vaults", "ai-mind");

const VAULT_NAME = process.env.SB_VAULT_NAME || "ai-mind";

function expandHome(p) {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

// Phase 8a.3: basename-first slugging with alias file + dirname-hash collision suffix.
// Old behavior (full path joined by `-`) produced ugly long slugs and round-tripped badly
// from Claude Code's sanitized JSONL dir names. New behavior: short, stable, human-readable.
function projectSlugFromCwd(cwd) {
  if (!cwd) return "_no-cwd";

  // 1. Alias file lookup (absolute path → user-chosen slug).
  const aliasFile = path.join(VAULT, "_meta", "project-aliases.json");
  if (fs.existsSync(aliasFile)) {
    try {
      const aliases = JSON.parse(fs.readFileSync(aliasFile, "utf8"));
      if (aliases[cwd]) return slugify(aliases[cwd]);
    } catch {}
  }

  // 2. Home dir special case.
  const home = os.homedir();
  if (cwd === home) return "home";

  // 3. Basename of cwd, with 4-char dirname hash suffix to disambiguate collisions.
  const base = path.basename(cwd);
  if (!base) return "_root";
  const hash = shortHash(path.dirname(cwd));
  const candidate = slugify(base);
  // Check if another cwd already claimed this candidate (cheap collision check via project-aliases reverse-lookup).
  if (fs.existsSync(aliasFile)) {
    try {
      const aliases = JSON.parse(fs.readFileSync(aliasFile, "utf8"));
      const otherCwd = Object.entries(aliases).find(([k, v]) => v === candidate && k !== cwd)?.[0];
      if (otherCwd) return `${candidate}-${hash}`;
    } catch {}
  }
  return candidate;
}

function shortHash(s) {
  // Tiny deterministic hash (djb2) → 4 hex chars.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).slice(0, 4);
}

// Phase 9: numbered-folder layout (mirrors my_vault conventions).
const DIR = {
  dashboard:    "00_Dashboard",
  conversations:"01_Conversations",
  projects:     "02_Projects",
  lessons:      "03_Lessons",
  topics:       "04_Topics",
  tasks:        "05_Tasks",        // global INDEX only; per-project tasks live under 02_Projects/<slug>/tasks/
  connections:  "06_Connections",
  reviews:      "07_Reviews",
  insights:     "08_Insights",
  exports:      "09_Exports",
  memory:       "10_Memory",       // mirror of the harness file-memory facts (see lib/memory-bridge.js)
  decisions:    "11_Decisions",    // ADR / decision notes (see commands/_runners/decision.js)
  people:       "12_People",       // people / CRM notes (see commands/_runners/person.js)
  meetings:     "13_Meetings",     // meeting notes (see commands/_runners/meeting.js)
  zettel:       "14_Zettelkasten", // atomic permanent notes (see commands/_runners/zettel.js)
  habits:       "15_Habits",       // habit tracker notes (see commands/_runners/habit.js)
  ideas:        "16_Ideas",         // captured ideas awaiting graduation (see commands/_runners/idea.js)
  inbox:        "99_Inbox",
  templates:    "_templates",
  assets:       "_assets",
  scribble:     "__scribble",
  meta:         "_meta",
};

// Map a top-level folder name (with or without numeric prefix) → canonical type slug
// used in note.type comparisons (retriever / connector / scoring).
const TYPE_MAP = {
  "00_Dashboard": "dashboard",
  "01_Conversations": "conversations",
  "02_Projects": "projects",
  "03_Lessons": "lessons",
  "04_Topics": "topics",
  "05_Tasks": "tasks",
  "06_Connections": "connections",
  "07_Reviews": "reviews",
  "08_Insights": "insights",
  "09_Exports": "exports",
  "10_Memory": "memory",
  "11_Decisions": "decisions",
  "12_People": "people",
  "13_Meetings": "meetings",
  "14_Zettelkasten": "zettel",
  "15_Habits": "habits",
  "16_Ideas": "ideas",
  "99_Inbox": "inbox",
  // legacy flat layout aliases (pre-migration)
  "dashboard":"dashboard","conversations":"conversations","projects":"projects",
  "lessons":"lessons","topics":"topics","tasks":"tasks","connections":"connections",
  "reviews":"reviews","insights":"insights","exports":"exports","inbox":"inbox",
};
function folderToType(name) {
  return TYPE_MAP[name] || String(name || "").replace(/^\d+_/, "").toLowerCase();
}

// Folders that should NEVER be walked by indexers (templates, assets, meta, scribble, dot-dirs).
const EXCLUDE_FOLDERS = ["_meta", "_templates", "_assets", "__scribble", "templates"];

function paths(projectSlug) {
  return {
    vault: VAULT,
    dashboard: path.join(VAULT, DIR.dashboard),
    dashboardHome: path.join(VAULT, DIR.dashboard, "Home.md"),
    dashboardToday: path.join(VAULT, DIR.dashboard, "Today.md"),
    conversations: path.join(VAULT, DIR.conversations, projectSlug),
    project: path.join(VAULT, DIR.projects, projectSlug),
    projectPlans: path.join(VAULT, DIR.projects, projectSlug, "plans"),
    projectIndex: path.join(VAULT, DIR.projects, projectSlug, "INDEX.md"),
    projectKanban: path.join(VAULT, DIR.projects, projectSlug, "kanban.md"),
    projectLessons: path.join(VAULT, DIR.projects, projectSlug, "lessons.md"),
    projectTasks: path.join(VAULT, DIR.projects, projectSlug, "tasks"),
    lessons: path.join(VAULT, DIR.lessons),
    tasks: path.join(VAULT, DIR.tasks),
    tasksIndex: path.join(VAULT, DIR.tasks, "INDEX.md"),
    topics: path.join(VAULT, DIR.topics),
    connections: path.join(VAULT, DIR.connections),
    inbox: path.join(VAULT, DIR.inbox),
    reviews: path.join(VAULT, DIR.reviews),
    reviewsDaily: path.join(VAULT, DIR.reviews, "Daily"),
    reviewsWeekly: path.join(VAULT, DIR.reviews, "Weekly"),
    insights: path.join(VAULT, DIR.insights),
    insightsMoc: path.join(VAULT, DIR.insights, "recurring-themes.md"),
    exports: path.join(VAULT, DIR.exports),
    memory: path.join(VAULT, DIR.memory),
    decisions: path.join(VAULT, DIR.decisions),
    people: path.join(VAULT, DIR.people),
    meetings: path.join(VAULT, DIR.meetings),
    zettel: path.join(VAULT, DIR.zettel),
    habits: path.join(VAULT, DIR.habits),
    ideas: path.join(VAULT, DIR.ideas),
    templates: path.join(VAULT, DIR.templates),
    assets: path.join(VAULT, DIR.assets),
    scribble: path.join(VAULT, DIR.scribble),
    meta: path.join(VAULT, DIR.meta),
    sessionMap: path.join(VAULT, DIR.meta, "session-map.json"),
    tagRules: path.join(VAULT, DIR.meta, "tag-rules.json"),
    tagAliases: path.join(VAULT, DIR.meta, "tag-aliases.json"),
    projectAliases: path.join(VAULT, DIR.meta, "project-aliases.json"),
    tagsIndex: path.join(VAULT, DIR.dashboard, "tags.md"),
  };
}

function ensureDirs(projectSlug) {
  const p = paths(projectSlug);
  for (const d of [
    p.dashboard, p.conversations, p.project, p.projectPlans, p.projectTasks,
    p.lessons, p.tasks, p.topics, p.connections, p.inbox,
    p.reviews, p.reviewsDaily, p.reviewsWeekly,
    p.insights, p.exports, p.memory, p.decisions,
    p.people, p.meetings, p.zettel, p.habits, p.ideas,
    p.templates, p.assets, p.scribble, p.meta,
  ]) {
    fs.mkdirSync(d, { recursive: true });
  }
  if (!fs.existsSync(p.sessionMap)) fs.writeFileSync(p.sessionMap, "{}\n");
  if (!fs.existsSync(p.tagRules)) fs.writeFileSync(p.tagRules, "{}\n");
  return p;
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function readSessionMap() {
  return readJSON(paths("_").sessionMap, {});
}

function writeSessionMap(map) {
  writeJSON(paths("_").sessionMap, map);
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

// Mark a session as ended in both session-map and the conversation file frontmatter.
// reason: "clean-exit" | "cleared" | "crashed" | "in-progress"
function markSessionEnded(sessionId, reason, endedAt = new Date().toISOString(), extra = {}) {
  const { updateFrontmatter, parseFrontmatter } = require("./markdown.js");
  const map = readSessionMap();
  const entry = map[sessionId];
  if (!entry) return false;

  // Don't overwrite a terminal state with in-progress
  if (reason === "in-progress" && entry.status === "ended") return false;

  entry.status = reason === "in-progress" ? "active" : "ended";
  entry.endedAt = reason === "in-progress" ? null : endedAt;
  entry.endedReason = reason;
  if (extra.clearedTo) entry.clearedTo = extra.clearedTo;
  if (extra.clearedFrom) entry.clearedFrom = extra.clearedFrom;
  map[sessionId] = entry;
  writeSessionMap(map);

  if (entry.file && fs.existsSync(entry.file)) {
    const updates = { ended_reason: reason };
    if (reason !== "in-progress") updates.ended_at = endedAt;
    if (extra.clearedTo) updates.cleared_to = extra.clearedTo;
    if (extra.clearedFrom) updates.cleared_from = extra.clearedFrom;
    updateFrontmatter(entry.file, updates);
  }
  return true;
}

module.exports = {
  VAULT, VAULT_NAME,
  DIR, TYPE_MAP, EXCLUDE_FOLDERS, folderToType,
  expandHome, slugify, projectSlugFromCwd,
  paths, ensureDirs,
  readJSON, writeJSON, readSessionMap, writeSessionMap,
  exists,
  markSessionEnded,
};
