// git.js — tiny generic git helper for sb. No knowledge of any external skill's
// artifacts; just resolves a repo root so vault features can key notes by project.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// Resolve the git repo root for a directory. Uses `git rev-parse`; falls back to
// walking up for a `.git` entry. Returns null if not inside a repo.
function repoRoot(cwd) {
  try {
    const out = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {}
  let dir = path.resolve(cwd);
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

module.exports = { repoRoot };
