// Parse / mutate Obsidian Kanban markdown.
// Columns are `## To Do`, `## Doing`, `## Done`. Tasks are `- [ ] text` / `- [x] text`.
// Trailing metadata in task lines: `#tag` and `due:YYYY-MM-DD` and `(done: ISO)`.

const fs = require("node:fs");
const path = require("node:path");

const COLUMNS = ["To Do", "Doing", "Done"];

function parseBoard(file) {
  if (!fs.existsSync(file)) return { columns: { "To Do": [], Doing: [], Done: [] }, raw: null };
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const cols = { "To Do": [], Doing: [], Done: [] };
  let current = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      current = COLUMNS.find((c) => c.toLowerCase() === h[1].toLowerCase()) || null;
      continue;
    }
    if (!current) continue;
    const t = line.match(/^-\s+\[( |x|X)\]\s+(.*)$/);
    if (t) cols[current].push({ done: t[1] !== " ", text: t[2].trim() });
  }
  return { columns: cols, raw: text };
}

function serializeBoard(board, projectSlug) {
  const lines = [
    "---",
    "type: kanban",
    `project: ${projectSlug}`,
    "kanban-plugin: board",
    "tags: [kanban]",
    "---",
    "",
  ];
  for (const col of COLUMNS) {
    lines.push(`## ${col}`, "");
    for (const t of board.columns[col]) {
      lines.push(`- [${t.done ? "x" : " "}] ${t.text}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function countKanban(file) {
  const b = parseBoard(file);
  return {
    todo: b.columns["To Do"].length,
    doing: b.columns["Doing"].length,
    done: b.columns["Done"].length,
  };
}

function addTask(file, projectSlug, text, { tags = [], due = null, noteLink = null } = {}) {
  const board = parseBoard(file);
  const parts = [];
  if (noteLink) parts.push(`[[${noteLink}]]`);
  parts.push(text);
  for (const t of tags) parts.push(t.startsWith("#") ? t : `#${t}`);
  if (due) parts.push(`due:${due}`);
  board.columns["To Do"].push({ done: false, text: parts.join(" ") });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serializeBoard(board, projectSlug));
}

function extractWikilink(text) {
  const m = String(text).match(/\[\[([^\]]+)\]\]/);
  return m ? m[1] : null;
}

function moveTask(file, projectSlug, selector, toCol) {
  const board = parseBoard(file);
  const todo = board.columns["To Do"];
  const idx = resolveIdx(todo, selector);
  if (idx === -1) return false;
  const [task] = todo.splice(idx, 1);
  if (toCol === "Done") {
    task.done = true;
    task.text = `${task.text} (done: ${new Date().toISOString().slice(0, 10)})`;
  }
  board.columns[toCol].push(task);
  fs.writeFileSync(file, serializeBoard(board, projectSlug));
  return true;
}

function resolveIdx(arr, selector) {
  if (/^\d+$/.test(String(selector))) {
    const n = parseInt(selector, 10) - 1;
    return n >= 0 && n < arr.length ? n : -1;
  }
  const needle = String(selector).toLowerCase();
  return arr.findIndex((t) => t.text.toLowerCase().includes(needle));
}

module.exports = { parseBoard, serializeBoard, countKanban, addTask, moveTask, extractWikilink, COLUMNS };
