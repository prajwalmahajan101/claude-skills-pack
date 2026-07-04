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
    if (typeof v === "object") {
      // One level of nested map, symmetric with parseFrontmatter's nested read.
      lines.push(`${k}:`);
      for (const [sk, sv] of Object.entries(v)) lines.push(`  ${sk}: ${quote(sv)}`);
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
  let pending = null; // an empty-valued key awaiting indented children (list or map)
  for (const line of head.split("\n")) {
    if (!line.trim()) continue;
    // Indented child of the last empty-valued key: a `- item` list entry or a
    // one-level nested `key: value` map. The first child decides which.
    if (pending && /^\s+/.test(line)) {
      const li = line.match(/^\s+-\s+(.*)$/);
      if (li) {
        if (!Array.isArray(meta[pending])) meta[pending] = [];
        meta[pending].push(unquote(li[1]));
        continue;
      }
      const kv = line.match(/^\s+([\w-]+):\s*(.*)$/);
      if (kv) {
        if (meta[pending] === null || Array.isArray(meta[pending])) meta[pending] = {};
        meta[pending][kv[1]] = coerceScalar(kv[2]);
        continue;
      }
    }
    pending = null;
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    key = m[1];
    const rest = m[2];
    // Empty value → could be an empty scalar, a list, or a nested map; defer until
    // we see (or don't see) indented children. Default to [] for back-compat.
    if (rest === "") { meta[key] = []; pending = key; }
    else meta[key] = coerceScalar(rest);
  }
  return { meta, body };
}

function coerceScalar(rest) {
  if (rest === "[]") return [];
  if (rest === "null") return null;
  if (rest === "true") return true;
  if (rest === "false") return false;
  return unquote(rest);
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
  // Unterminated frontmatter (leading '---' with no closing '---'): parseFrontmatter
  // returns the whole file as body, so writing fm()+body would stack a SECOND block
  // and corrupt the note. Refuse rather than double it. (A valid empty '---\n---\n'
  // has a closing delimiter and is handled normally.)
  if (content.startsWith("---\n") && content.indexOf("\n---\n", 4) === -1) {
    console.error(`sb: refusing to update malformed frontmatter (no closing '---'): ${filePath}`);
    return;
  }
  const { meta, body } = parseFrontmatter(content);
  const merged = { ...meta, ...updates };
  fs.writeFileSync(filePath, fm(merged) + body);
}

module.exports = {
  fm, parseFrontmatter, renderTurns,
  writeConversation, appendConversation, updateFrontmatter,
};
