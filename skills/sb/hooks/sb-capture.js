#!/usr/bin/env node
// sb-capture: Stop / SubagentStop hook.
// Reads the session JSONL since last offset, appends new turns to the conversation file,
// updates session-map.json metadata. Idempotent + debounced.

if (process.env.SB_DISABLE === "1") process.exit(0);

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { ensureDirs, projectSlugFromCwd, readSessionMap, writeSessionMap, paths, markSessionEnded } = require(path.join(SKILL_LIB, "vault.js"));
const { sessionFilePath, readEvents, toTurns } = require(path.join(SKILL_LIB, "jsonl.js"));
const { fm, renderTurns, parseFrontmatter, writeConversation, updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const DEBOUNCE_MS = parseInt(process.env.SB_CAPTURE_DEBOUNCE_MS || "5000", 10);

main().catch((e) => {
  try {
    const log = path.join(os.homedir(), ".claude", "cache", "sb-capture.log");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `${new Date().toISOString()} ERROR ${e.stack || e.message}\n`);
  } catch {}
  process.exit(0); // never block the session
});

async function main() {
  const input = await readStdin();
  const hook = input ? safeJSON(input) : {};
  const sessionId = hook.session_id || hook.sessionId || process.env.CLAUDE_SESSION_ID;
  const cwd = hook.cwd || process.cwd();
  if (!sessionId) return;

  const slug = projectSlugFromCwd(cwd);
  const p = ensureDirs(slug);

  const jsonlPath = sessionFilePath(cwd, sessionId);
  const map = readSessionMap();
  const prev = map[sessionId] || { byteOffset: 0, turnCount: 0, file: null, project: slug };

  // Debounce: skip if last write was very recent.
  if (prev.lastWriteAt && Date.now() - new Date(prev.lastWriteAt).getTime() < DEBOUNCE_MS) {
    return;
  }

  const { events, size } = readEvents(jsonlPath, prev.byteOffset || 0);
  if (events.length === 0) return;

  const { metadata, turns } = toTurns(events);
  if (turns.length === 0) {
    prev.byteOffset = size;
    map[sessionId] = prev;
    writeSessionMap(map);
    return;
  }

  // Determine conversation file (create new or append to existing).
  let file = prev.file;
  let isNew = false;
  if (!file) {
    const titleSlug = metadata.title ? slugifyTitle(metadata.title) : "untitled";
    file = path.join(p.conversations, `${sessionId}__${titleSlug}.md`);
    isNew = !fs.existsSync(file);
  }

  if (isNew) {
    const front = {
      session_id: sessionId,
      title: metadata.title || "(untitled session)",
      project: slug,
      project_path: cwd,
      model: metadata.model || "",
      started_at: metadata.startedAt || new Date().toISOString(),
      last_updated: metadata.lastEventAt || new Date().toISOString(),
      duration_minutes: durationMin(metadata.startedAt, metadata.lastEventAt),
      turn_count: turns.length,
      plans: [],
      tags: [],
      analyzed: false,
      analysis_summary: null,
      resumed_from: null,
      ended_at: null,
      ended_reason: "in-progress",
      cleared_to: null,
      cleared_from: prev.clearedFrom || null,
    };
    const body = `# ${front.title}\n\n` + renderTurns(turns, 1);
    writeConversation(file, front, body);
  } else {
    // Append under a "Resume" separator if returning after a gap.
    const existing = fs.readFileSync(file, "utf8");
    const { meta } = parseFrontmatter(existing);
    const sinceMin = meta.last_updated
      ? (new Date() - new Date(meta.last_updated)) / 60000
      : 0;
    const header = sinceMin > 30
      ? `\n---\n\n## Resume — ${new Date().toISOString().replace("T", " ").slice(0, 16)}`
      : "";
    const body = renderTurns(turns, (prev.turnCount || 0) + 1);
    fs.appendFileSync(file, (header ? header + "\n\n" : "\n") + body);
    updateFrontmatter(file, {
      last_updated: metadata.lastEventAt || new Date().toISOString(),
      duration_minutes: durationMin(meta.started_at, metadata.lastEventAt),
      turn_count: (prev.turnCount || 0) + turns.length,
    });
  }

  map[sessionId] = {
    ...prev,
    file,
    project: slug,
    byteOffset: size,
    turnCount: (prev.turnCount || 0) + turns.length,
    lastWriteAt: new Date().toISOString(),
    status: prev.status === "ended" ? "ended" : "active",
  };
  writeSessionMap(map);

  // Mark as in-progress (unless already terminal) so a crashed session is detectable later.
  if (map[sessionId].status !== "ended") {
    markSessionEnded(sessionId, "in-progress");
  }
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 500);
  });
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

function durationMin(start, end) {
  if (!start || !end) return 0;
  return Math.round((new Date(end) - new Date(start)) / 60000);
}

function slugifyTitle(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "untitled";
}
