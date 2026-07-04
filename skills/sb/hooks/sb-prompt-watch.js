#!/usr/bin/env node
// sb-prompt-watch: UserPromptSubmit hook. Flag /clear so SessionEnd can mark `ended_reason: cleared`.

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
const { updateSessionMap } = require(path.join(SKILL_LIB, "vault.js"));

try { main(); } catch (e) { logErr(e); }

function main() {
  const input = readStdinSync();
  const hook = safeJSON(input);
  const sessionId = hook.session_id || hook.sessionId;
  const prompt = (hook.prompt || hook.user_prompt || hook.input || "").trim();
  if (!sessionId || !prompt) return;

  // Only flag explicit clear commands.
  if (!/^\s*\/clear\b/i.test(prompt)) return;

  updateSessionMap((map) => {
    const entry = map[sessionId] || {};
    entry.pendingClear = true;
    entry.pendingClearAt = new Date().toISOString();
    map[sessionId] = entry;
  });
}

function readStdinSync() {
  try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

function logErr(e) {
  try {
    const log = path.join(os.homedir(), ".claude", "cache", "sb-prompt-watch.log");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `${new Date().toISOString()} ERROR ${e.stack || e.message}\n`);
  } catch {}
}
