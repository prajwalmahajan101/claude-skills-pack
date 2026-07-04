#!/usr/bin/env node
// lesson-miner-trigger (SessionStart hook) — fires the lesson miner in the
// BACKGROUND so it never blocks session startup. The heavy work (reading a
// finished transcript + one `claude -p` call) runs detached in lesson-miner.js.
//
// This trigger returns in milliseconds. It is a no-op when:
//  - LESSON_MINER=1 (we are inside a mined sub-invocation — recursion guard)
//  - SB_DISABLE=1 or LESSON_MINER_DISABLE=1 (kill switch)

try {
  if (process.env.LESSON_MINER === "1") process.exit(0);
  if (process.env.SB_DISABLE === "1" || process.env.LESSON_MINER_DISABLE === "1") process.exit(0);

  const os = require("node:os");
  const path = require("node:path");
  const fs = require("node:fs");
  const { spawn } = require("node:child_process");

  const worker = path.join(os.homedir(), ".claude", "hooks", "lesson-miner.js");
  if (!fs.existsSync(worker)) process.exit(0);

  const child = spawn(process.execPath, [worker], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  child.unref();
} catch {
  // never break session startup
}
process.exit(0);
