// Parse Claude Code session JSONL → ordered turn list.
// Each line is a JSON event; we extract user/assistant text and slash commands,
// summarize tool calls to one line, and skip system noise.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

function sanitizedCwd(cwd) {
  return cwd.replace(/[/\\]/g, "-").replace(/^-+/, "-");
}

function sessionFilePath(cwd, sessionId) {
  const dir = path.join(os.homedir(), ".claude", "projects", sanitizedCwd(cwd));
  return path.join(dir, `${sessionId}.jsonl`);
}

function readEvents(file, fromByte = 0) {
  if (!fs.existsSync(file)) return { events: [], size: 0 };
  const stat = fs.statSync(file);
  if (fromByte >= stat.size) return { events: [], size: stat.size };
  const fd = fs.openSync(file, "r");
  const len = stat.size - fromByte;
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, fromByte);
  fs.closeSync(fd);

  // Only consume through the LAST newline in this window. A trailing partial line
  // (the writer flushed mid-record, or the read boundary split a record) is left
  // unconsumed so it is re-read whole on the next call — otherwise its bytes would
  // be marked read and the completed record lost. Slicing on a '\n' byte is also
  // UTF-8-safe: a multibyte codepoint never contains 0x0a, so we never cut one.
  const lastNl = buf.lastIndexOf(0x0a);
  if (lastNl === -1) return { events: [], size: fromByte };
  const text = buf.slice(0, lastNl + 1).toString("utf8");

  const events = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return { events, size: fromByte + lastNl + 1 };
}

// Extract a simple "turn" stream from raw events.
// turn = { role: "user"|"assistant", time, text, tools: [{name, summary}] }
function toTurns(events) {
  const turns = [];
  let metadata = {};
  for (const ev of events) {
    if (ev.type === "file-history-snapshot") continue;
    if (!metadata.sessionId && ev.sessionId) metadata.sessionId = ev.sessionId;
    if (!metadata.cwd && ev.cwd) metadata.cwd = ev.cwd;
    if (!metadata.startedAt && ev.timestamp) metadata.startedAt = ev.timestamp;
    if (ev.timestamp) metadata.lastEventAt = ev.timestamp;
    if (ev.summary && !metadata.title) metadata.title = ev.summary;
    if (ev.model && !metadata.model) metadata.model = ev.model;

    if (ev.type === "user" || ev.type === "assistant") {
      const text = extractText(ev);
      const tools = extractTools(ev);
      if (text || tools.length) {
        turns.push({
          role: ev.type,
          time: ev.timestamp || null,
          text: text || "",
          tools,
        });
      }
    }
  }
  return { metadata, turns };
}

function extractText(ev) {
  // Look in common locations for human-readable text.
  if (typeof ev.text === "string") return ev.text;
  if (ev.message && typeof ev.message.content === "string") return ev.message.content;
  if (ev.message && Array.isArray(ev.message.content)) {
    return ev.message.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  if (Array.isArray(ev.content)) {
    return ev.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  if (typeof ev.content === "string") return ev.content;
  return "";
}

function extractTools(ev) {
  const blocks =
    (ev.message && Array.isArray(ev.message.content) && ev.message.content) ||
    (Array.isArray(ev.content) && ev.content) ||
    [];
  return blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      name: b.name,
      summary: summarizeToolInput(b.name, b.input),
    }));
}

function summarizeToolInput(name, input) {
  if (!input || typeof input !== "object") return "";
  if (name === "Bash") return truncate(input.command || "", 120);
  if (name === "Write" || name === "Edit" || name === "Read") return input.file_path || "";
  if (name === "Grep") return `${input.pattern || ""} ${input.path || ""}`.trim();
  if (name === "Glob") return input.pattern || "";
  if (name === "WebFetch") return input.url || "";
  return truncate(JSON.stringify(input), 120);
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

module.exports = { sessionFilePath, readEvents, toTurns };
