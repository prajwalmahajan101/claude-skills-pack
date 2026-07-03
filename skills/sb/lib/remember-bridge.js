// remember-bridge.js — bridge between sb and the ~/.remember rolling history.
//
// The `remember` system keeps a rolling activity log:
//   now.md (live buffer) -> today-<date>.md -> recent.md (7d) -> archive.md
// sb appends one-line activity entries to now.md when it captures a lesson or
// runs a consolidation, and reads recent.md to surface recent context in the
// project INDEX. Writes are additive and grouped under a `## <date>` heading so
// they merge cleanly with whatever the remember skill already wrote.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

function rememberDir() {
  if (process.env.SB_REMEMBER_DIR) return expand(process.env.SB_REMEMBER_DIR);
  return path.join(os.homedir(), ".remember");
}
function expand(p) { return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p; }

// Append a dated one-liner to now.md under today's `## YYYY-MM-DD` heading.
// Prefixes the line with `[sb]` so provenance is obvious. Best-effort: never
// throws (the caller should not fail just because history logging did).
function logActivity(line) {
  try {
    const dir = rememberDir();
    if (!fs.existsSync(dir)) return false; // don't create the system if absent
    const file = path.join(dir, "now.md");
    const date = new Date().toISOString().slice(0, 10);
    const heading = `## ${date}`;
    const entry = `- [sb] ${String(line || "").replace(/\n/g, " ").trim()}`;
    let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "# Now\n";
    if (text.includes(heading)) {
      // Insert the entry right after the heading line.
      text = text.replace(heading, `${heading}\n${entry}`);
    } else {
      text = text.replace(/\s*$/, "") + `\n\n${heading}\n${entry}\n`;
    }
    fs.writeFileSync(file, text);
    return true;
  } catch { return false; }
}

// Read recent.md (7-day rolling window). Returns "" if absent.
function readRecent(maxChars = 4000) {
  try {
    const file = path.join(rememberDir(), "recent.md");
    if (!fs.existsSync(file)) return "";
    return fs.readFileSync(file, "utf8").slice(0, maxChars);
  } catch { return ""; }
}

// Return up to `n` most recent non-empty, non-heading, non-fence lines from
// recent.md — handy for a compact "what happened lately" summary.
function recentHighlights(n = 5) {
  const text = readRecent();
  if (!text) return [];
  const lines = text.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("```") && !l.startsWith("- IDENTITY"));
  return lines.slice(0, n);
}

module.exports = { rememberDir, logActivity, readRecent, recentHighlights };
