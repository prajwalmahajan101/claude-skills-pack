#!/usr/bin/env node
// sb-session-end: SessionEnd hook. Final flush + mark conversation as ended.
// Reads `pending_clear` flag set by sb-prompt-watch.js to distinguish clean-exit vs cleared.

if (process.env.SB_DISABLE === "1") process.exit(0);

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { readSessionMap, writeSessionMap, markSessionEnded } = require(path.join(SKILL_LIB, "vault.js"));

try { main(); } catch (e) { logErr(e); }

function main() {
  const input = readStdinSync();
  const hook = safeJSON(input);
  const sessionId = hook.session_id || hook.sessionId;
  if (!sessionId) return;

  // Final flush: invoke the capture hook synchronously with the same payload.
  const captureHook = path.join(os.homedir(), ".claude", "hooks", "sb-capture.js");
  if (fs.existsSync(captureHook)) {
    spawnSync(process.execPath, [captureHook], { input, encoding: "utf8", timeout: 8000 });
  }

  const map = readSessionMap();
  const entry = map[sessionId];
  const reason = entry?.pendingClear ? "cleared" : "clean-exit";

  if (entry?.pendingClear) {
    delete entry.pendingClear;
    map[sessionId] = entry;
    writeSessionMap(map);
  }

  markSessionEnded(sessionId, reason);
}

function readStdinSync() {
  try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

function logErr(e) {
  try {
    const log = path.join(os.homedir(), ".claude", "cache", "sb-session-end.log");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `${new Date().toISOString()} ERROR ${e.stack || e.message}\n`);
  } catch {}
}
