#!/usr/bin/env node
// sb-plan-mirror: PostToolUse hook. When ~/.claude/plans/<file>.md is written/edited,
// copy it to vault/projects/<current-slug>/plans/<basename>.

if (process.env.SB_DISABLE === "1") process.exit(0);

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Resolve lib from the in-repo sibling (tests) or the installed skill dir. When this
// hook runs from ~/.claude/hooks, __dirname/../lib is ~/.claude/lib (wrong) — fall back
// to the installed skill's lib so the hook works after install.sh copies it there.
const SKILL_LIB = fs.existsSync(path.join(__dirname, "..", "lib", "vault.js"))
  ? path.join(__dirname, "..", "lib")
  : path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { ensureDirs, projectSlugFromCwd, paths, readSessionMap, writeSessionMap } = require(path.join(SKILL_LIB, "vault.js"));
const { updateFrontmatter, parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const PLANS_DIR = path.join(os.homedir(), ".claude", "plans");

try { main(); } catch (e) { logErr(e); }

function main() {
  const input = readStdinSync();
  const hook = safeJSON(input);
  const cwd = hook.cwd || process.cwd();
  const sessionId = hook.session_id || hook.sessionId;
  const filePath = hook.tool_input?.file_path || hook.tool_input?.filePath;
  if (!filePath) return;
  if (!filePath.startsWith(PLANS_DIR + path.sep)) return;
  if (!fs.existsSync(filePath)) return;

  const slug = projectSlugFromCwd(cwd);
  const p = ensureDirs(slug);
  const dest = path.join(p.projectPlans, path.basename(filePath));
  fs.copyFileSync(filePath, dest);

  // Track plan in conversation frontmatter if we have a current session file
  if (sessionId) {
    const map = readSessionMap();
    const entry = map[sessionId];
    if (entry && entry.file && fs.existsSync(entry.file)) {
      const { meta } = parseFrontmatter(fs.readFileSync(entry.file, "utf8"));
      const plans = new Set(meta.plans || []);
      plans.add(path.basename(filePath));
      updateFrontmatter(entry.file, { plans: [...plans] });
    }
  }
}

function readStdinSync() {
  try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

function logErr(e) {
  try {
    const log = path.join(os.homedir(), ".claude", "cache", "sb-plan-mirror.log");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `${new Date().toISOString()} ERROR ${e.stack || e.message}\n`);
  } catch {}
}
