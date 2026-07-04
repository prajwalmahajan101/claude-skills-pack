"use strict";
// Standalone tests for sb's vault-ingest primitive and git helper. Zero-dependency:
// node:test + node:assert. sb stays sutra-blind — these tests build payloads by
// hand (sb owns its own ingest contract) and never reference a sibling member.
// Run: node --test  (from skills/sb/)

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const INGEST = path.join(__dirname, "..", "commands", "_runners", "ingest.js");
const { repoRoot } = require("../lib/git.js");

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "sb-test-")); }

// Run ingest.js as a real subprocess against a throwaway vault. Returns { status,
// stdout, stderr, vault }. SB_VAULT_PATH steers every vault write into the temp dir.
function ingest(payload, extraEnv = {}) {
  const vault = tmp();
  const payloadFile = path.join(tmp(), "payload.json");
  fs.writeFileSync(payloadFile, JSON.stringify(payload));
  const r = cp.spawnSync("node", [INGEST, "--payload", payloadFile], {
    encoding: "utf8",
    env: { ...process.env, SB_VAULT_PATH: vault, ...extraEnv },
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", vault };
}

// sb lays notes down under <vault>/02_Projects/<slug>/<folder>/<name>.
function projectDir(vault, slug) { return path.join(vault, "02_Projects", slug); }

test("ingest writes each note as a typed project note", () => {
  const { status, vault } = ingest({
    project: "demo",
    notes: [
      { folder: "journal", name: "M1.md", type: "journal", title: "Phase 1", content: "did the thing" },
      { folder: "decisions", name: "0001-x.md", type: "decision", title: "Chose X", content: "because Y" },
    ],
  });
  assert.equal(status, 0);
  const j = path.join(projectDir(vault, "demo"), "journal", "M1.md");
  const d = path.join(projectDir(vault, "demo"), "decisions", "0001-x.md");
  assert.ok(fs.existsSync(j), "journal note written");
  assert.ok(fs.existsSync(d), "decision note written");
  const jt = fs.readFileSync(j, "utf8");
  assert.match(jt, /type: journal/, "frontmatter carries the note type");
  assert.match(jt, /project: demo/, "frontmatter carries the project slug");
  assert.match(jt, /did the thing/, "body content preserved");
});

test("ingest refreshes the project INDEX open-issues section", () => {
  const { status, vault } = ingest({
    project: "demo",
    notes: [{ folder: "reviews", name: "r.md", type: "code-review", title: "Review", content: "body" }],
    openIssues: [
      { id: "ISSUE-001", severity: "high", title: "unbounded query" },
      { id: "ISSUE-002", severity: "low", title: "typo in log" },
    ],
  });
  assert.equal(status, 0);
  const index = fs.readFileSync(path.join(projectDir(vault, "demo"), "INDEX.md"), "utf8");
  assert.match(index, /## Open review issues/);
  assert.match(index, /2 open/);
  assert.match(index, /ISSUE-001.*unbounded query/);
  assert.match(index, /ISSUE-002.*typo in log/);
});

test("ingest skips notes missing name or content, and reports the count", () => {
  const { status, stdout, vault } = ingest({
    project: "demo",
    notes: [
      { folder: "journal", name: "ok.md", type: "journal", title: "kept", content: "body" },
      { folder: "journal", type: "journal", content: "no name — skipped" },
      { folder: "journal", name: "nobody.md", type: "journal" },
    ],
  });
  assert.equal(status, 0);
  assert.match(stdout, /1 note\(s\)/, "only the well-formed note is written");
  const dir = path.join(projectDir(vault, "demo"), "journal");
  assert.deepEqual(fs.readdirSync(dir), ["ok.md"]);
});

test("ingest fails loudly on a payload with no project slug", () => {
  const { status, stderr } = ingest({ notes: [] });
  assert.notEqual(status, 0, "exits non-zero");
  assert.match(stderr, /project/, "explains the missing slug");
});

test("ingest sanitizes folder + file names, preventing path traversal", () => {
  const { status, vault } = ingest({
    project: "demo",
    notes: [{ folder: "../escape", name: "a/b\\c.md", type: "note", title: "t", content: "MARKER" }],
  });
  assert.equal(status, 0);
  // The write must stay inside the project dir — no `..` escape, no path separators
  // in the filename. Locate the note by content rather than guessing the sanitized
  // segment, then assert its resolved path is under the project dir.
  // walk() only descends the project dir, so locating the note there already proves
  // it did not escape. The traversal invariant is that nothing landed as a sibling.
  const found = walk(projectDir(vault, "demo")).find((f) => fs.readFileSync(f, "utf8").includes("MARKER"));
  assert.ok(found, "note written inside the project dir");
  assert.ok(!path.basename(found).includes("/") && !path.basename(found).includes("\\"), "filename separators stripped");
  assert.ok(!fs.existsSync(path.join(vault, "escape")), "no sibling at the vault root");
  assert.ok(!fs.existsSync(path.join(vault, "02_Projects", "escape")), "no sibling beside the project dir");
});

function walk(dir) {
  const out = [];
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// --- git.js repoRoot ---------------------------------------------------------

test("repoRoot resolves the toplevel of a git repo", () => {
  const dir = tmp();
  cp.spawnSync("git", ["-C", dir, "init"], { encoding: "utf8" });
  const nested = path.join(dir, "a", "b");
  fs.mkdirSync(nested, { recursive: true });
  const got = repoRoot(nested);
  assert.ok(got, "resolves a root from a nested dir");
  assert.equal(fs.realpathSync(got), fs.realpathSync(dir), "root is the repo toplevel");
});

test("repoRoot returns null outside any git repo", () => {
  // os.tmpdir() itself is not a git repo; a fresh child of it has no .git ancestor
  // within the walk unless the machine tmp is versioned — guard against that.
  const dir = tmp();
  const got = repoRoot(dir);
  if (got !== null) assert.ok(fs.existsSync(path.join(got, ".git")), "if non-null, it is a real repo root");
});
