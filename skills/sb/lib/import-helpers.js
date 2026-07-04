// Shared conversation-import helpers used by both the backfill runner and the
// one-time vault-repair migration. Keeping self-capture detection, filename
// derivation, and link-wiring in one place guarantees the live import path and
// the retroactive repair agree on exactly what counts as junk / how notes are named.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKILL_LIB = __dirname;
const { tagFile } = require(path.join(SKILL_LIB, "tagger.js"));
const { parseFrontmatter, fm } = require(path.join(SKILL_LIB, "markdown.js"));

// First-user-turn text signatures that mark a session as sb's OWN headless
// `claude -p` sub-invocation (analyzer / summarizer / connector), not a real
// user conversation. These must never be captured into the vault.
const SELF_CAPTURE_SIGNATURES = [
  "You are summarizing a Claude Code session",
  "daily memory log",
  "You are a second-brain",
  "You are analyzing a Claude Code conversation",
  "Return ONLY valid JSON",
];

const SCRATCH_PREFIXES = ["/tmp", "/var/tmp", os.tmpdir()];

function firstUserText(turns) {
  const u = (turns || []).find((t) => t.role === "user" && t.text && t.text.trim());
  return u ? u.text.trim() : "";
}

function inScratch(cwd) {
  const norm = String(cwd || "").replace(/\/+$/, "");
  return SCRATCH_PREFIXES.some((p) => p && (norm === p || norm.startsWith(p + "/")));
}

// A session is self-capture if its first user turn matches a known sb prompt,
// or (backstop) it is a <=2-turn round-trip that ran in a scratch dir.
function isSelfCapture(turns, cwd) {
  const head = firstUserText(turns).slice(0, 400);
  if (SELF_CAPTURE_SIGNATURES.some((sig) => head.includes(sig))) return true;
  if (inScratch(cwd) && (turns || []).length <= 2) return true;
  return false;
}

// Human title: prefer the JSONL-summary title, else the first line of the first
// user turn (trimmed), else a dated placeholder.
function deriveTitle(turns, metadataTitle) {
  if (metadataTitle && metadataTitle.trim()) return metadataTitle.trim();
  const first = firstUserText(turns).split("\n").find((l) => l.trim());
  if (first) {
    return first.replace(/^[#>*\-\s]+/, "").replace(/\s+/g, " ").trim().slice(0, 60) || "(untitled session)";
  }
  return "(untitled session)";
}

// Human-legible, uuid-free filename: `YYYY-MM-DD--<sid8>.md`.
function noteFileName(sid, startedAtIso, fallbackMs) {
  let stamp = "";
  if (startedAtIso && /^\d{4}-\d{2}-\d{2}/.test(startedAtIso)) stamp = startedAtIso.slice(0, 10);
  else if (fallbackMs) stamp = new Date(fallbackMs).toISOString().slice(0, 10);
  else stamp = "0000-00-00";
  return `${stamp}--${String(sid).slice(0, 8)}.md`;
}

// Register a conversation note as a [[backlink]] under the project INDEX.md
// "## Conversations" section (creating the section if missing). Idempotent.
function registerInIndex(projectIndexPath, noteFile) {
  if (!fs.existsSync(projectIndexPath)) return false;
  const link = `- [[${path.basename(noteFile, ".md")}]]`;
  let content = fs.readFileSync(projectIndexPath, "utf8");
  if (content.includes(link)) return false;
  const heading = /^##\s+Conversations\s*$/m;
  if (heading.test(content)) {
    // Insert directly under the heading, replacing any "Stored under …" note line.
    content = content.replace(heading, (h) => `${h}\n${link}`);
    content = content.replace(/\n> ?Stored under[^\n]*\n/, "\n");
    content = content.replace(/\nStored under[^\n]*\n/, "\n");
  } else {
    content = content.replace(/\s*$/, "") + `\n\n## Conversations\n${link}\n`;
  }
  fs.writeFileSync(projectIndexPath, content);
  return true;
}

// Append a "## Related" section of [[backlinks]] to a note. `related` is an
// array of basenames (no extension). Idempotent — skips if the section exists.
function addRelated(noteFile, related) {
  if (!related || !related.length) return false;
  const content = fs.readFileSync(noteFile, "utf8");
  if (/^##\s+Related\s*$/m.test(content)) return false;
  const block = "\n## Related\n\n" + related.map((r) => `- [[${r}]]`).join("\n") + "\n";
  fs.appendFileSync(noteFile, block);
  return true;
}

// One-shot linkage for a freshly written note: auto-tag, register in its project
// INDEX, and append a Related section. `relatedBasenames` is precomputed by the
// caller (so the migration can score once instead of O(n^2) re-scans).
function wireLinks({ noteFile, projectIndexPath, relatedBasenames = [] }) {
  const tags = tagFile(noteFile);
  const indexed = registerInIndex(projectIndexPath, noteFile);
  const related = addRelated(noteFile, relatedBasenames);
  return { tags, indexed, related };
}

module.exports = {
  SELF_CAPTURE_SIGNATURES,
  firstUserText,
  inScratch,
  isSelfCapture,
  deriveTitle,
  noteFileName,
  registerInIndex,
  addRelated,
  wireLinks,
};
