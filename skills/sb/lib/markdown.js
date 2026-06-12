// Render turns to markdown; build/update conversation frontmatter.

const fs = require("node:fs");
const path = require("node:path");

function fm(obj) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) { lines.push(`${k}: null`); continue; }
    if (Array.isArray(v)) {
      if (v.length === 0) { lines.push(`${k}: []`); continue; }
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${quote(item)}`);
      continue;
    }
    lines.push(`${k}: ${quote(v)}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}

function quote(v) {
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  if (/^[\w\-./:T+]+$/.test(s) && !s.startsWith("-")) return s;
  return JSON.stringify(s);
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return { meta: {}, body: content };
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return { meta: {}, body: content };
  const head = content.slice(4, end);
  const body = content.slice(end + 5);
  const meta = {};
  let key = null;
  let arr = null;
  for (const line of head.split("\n")) {
    if (!line.trim()) continue;
    if (arr && /^\s+-\s+/.test(line)) {
      arr.push(unquote(line.replace(/^\s+-\s+/, "")));
      continue;
    }
    arr = null;
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    key = m[1];
    const rest = m[2];
    if (rest === "") { meta[key] = []; arr = meta[key]; }
    else if (rest === "[]") meta[key] = [];
    else if (rest === "null") meta[key] = null;
    else if (rest === "true") meta[key] = true;
    else if (rest === "false") meta[key] = false;
    else meta[key] = unquote(rest);
  }
  return { meta, body };
}

function unquote(s) {
  if (s.startsWith('"') && s.endsWith('"')) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  return s;
}

function renderTurns(turns, startIndex = 1) {
  const out = [];
  let i = startIndex;
  for (const t of turns) {
    const time = t.time ? new Date(t.time).toISOString().replace("T", " ").slice(0, 16) : "";
    const role = t.role === "user" ? "user" : "assistant";
    out.push(`## Turn ${i} — ${time} (${role})`);
    if (t.text && t.text.trim()) out.push("", t.text.trim());
    if (t.tools && t.tools.length) {
      out.push("");
      for (const tool of t.tools) {
        out.push(`> _tool: ${tool.name}_ — \`${escapeInline(tool.summary)}\``);
      }
    }
    out.push("");
    i++;
  }
  return out.join("\n");
}

function escapeInline(s) {
  return String(s || "").replace(/`/g, "\\`");
}

function writeConversation(filePath, frontmatter, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, fm(frontmatter) + "\n" + body);
}

function appendConversation(filePath, header, body) {
  fs.appendFileSync(filePath, "\n" + header + "\n\n" + body);
}

function updateFrontmatter(filePath, updates) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const { meta, body } = parseFrontmatter(content);
  const merged = { ...meta, ...updates };
  fs.writeFileSync(filePath, fm(merged) + body);
}

module.exports = {
  fm, parseFrontmatter, renderTurns,
  writeConversation, appendConversation, updateFrontmatter,
};
