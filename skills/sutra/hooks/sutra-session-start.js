#!/usr/bin/env node
"use strict";
// sutra SessionStart hook — orients the session on which pack members are active
// and surfaces up to 2 repo-scoped risks via fused recall (composing whichever
// members are present). Fast + defensive: never throws, never blocks. Honors
// SUTRA_DISABLE=1. Risk enrichment can be turned off with SUTRA_HOOK_RISKS=0.

if (process.env.SUTRA_DISABLE === "1") process.exit(0);

(function main() {
  try {
    const path = require("node:path");
    const cp = require("node:child_process");
    const tools = require(path.join(__dirname, "..", "bin", "sutra-tools.js"));
    const reg = tools.registry();
    const present = reg.present || [];
    if (!present.length) process.exit(0);

    const lines = [`sutra: pack members active — ${present.join(", ")}. Unified surface: /sutra:<command> (catch-all: /sutra:do).`];

    // Repo-scoped risks via fused recall — only inside a git repo, keyword-biased
    // by repo name + branch. Bounded so the hook never approaches its timeout.
    if (process.env.SUTRA_HOOK_RISKS !== "0" && isGitRepo(cp)) {
      for (const r of topRisks(tools)) lines.push(`**Risk:** ${r.text} \`${(r.ref || "").split("/").pop()}\``);
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") },
    }) + "\n");
  } catch {
    // Orientation is best-effort; a failure here must never disrupt the session.
  }
  process.exit(0);
})();

function isGitRepo(cp) {
  const r = cp.spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  return r.status === 0 && (r.stdout || "").trim() === "true";
}

function topRisks(tools) {
  try {
    const ctx = repoContext();
    // No usable repo context (detached HEAD / no branch) → skip enrichment rather
    // than surfacing unranked noise; the roster line is already built regardless.
    if (!ctx) return [];
    // Tight per-child timeout (1.5s) so two member spawns stay well under the
    // hook's 5s budget — the hook never depends on recall's default 8s cap.
    const r = tools.recallFused(["--context", ctx, "--limit", "6", "--timeout", "1500"]);
    return (r.risks || []).slice(0, 2).map((x) => ({ text: String(x.text).slice(0, 120), ref: x.ref }));
  } catch { return []; }
}

function repoContext() {
  const cp = require("node:child_process");
  const path = require("node:path");
  const top = cp.spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  const branch = cp.spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  const name = top.status === 0 ? path.basename((top.stdout || "").trim()) : "";
  return [name, branch.status === 0 ? (branch.stdout || "").trim() : ""].filter(Boolean).join(" ");
}
