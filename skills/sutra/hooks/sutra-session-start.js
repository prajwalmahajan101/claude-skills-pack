#!/usr/bin/env node
"use strict";
// sutra SessionStart hook — orients the session on which pack members are active.
// Fast + defensive: never throws, never blocks. Honors SUTRA_DISABLE=1.
// Phase 6 enriches this with up to 2 repo-scoped risks via fused recall.

if (process.env.SUTRA_DISABLE === "1") process.exit(0);

(function main() {
  try {
    const path = require("node:path");
    const tools = require(path.join(__dirname, "..", "bin", "sutra-tools.js"));
    const reg = tools.registry();
    const present = reg.present || [];
    if (!present.length) process.exit(0);
    const lines = [`sutra: pack members active — ${present.join(", ")}. Unified surface: /sutra:<command>.`];
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") },
    }) + "\n");
  } catch {
    // Orientation is best-effort; a failure here must never disrupt the session.
  }
  process.exit(0);
})();
