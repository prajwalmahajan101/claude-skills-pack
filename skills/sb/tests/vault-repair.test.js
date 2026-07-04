"use strict";
// Integration tests for sb-vault-repair.js against a throwaway SB_VAULT_PATH vault.
// This tool force-deletes vault scope directories (fs.rmSync recursive) and renames
// notes; H4 flagged it as running with ZERO tests. These drive the real bin as a
// subprocess and assert exactly which paths are removed vs preserved, so a
// scope-computation bug that would nuke the wrong directory is caught.
// Zero-dep: node:test + node:assert. Run: node --test  (from skills/sb/)

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const BIN = path.join(__dirname, "..", "bin", "sb-vault-repair.js");

function conv(meta, body) {
  const fm = ["---"];
  for (const [k, v] of Object.entries(meta)) fm.push(`${k}: ${v}`);
  fm.push("---", "");
  return fm.join("\n") + body + "\n";
}

// Build a fresh vault fixture. Layout:
//   01_Conversations/keep/        one real (turn=5) note        → survives (renamed)
//   01_Conversations/lowturn/     one turn=1 note               → purged → scope deleted
//   01_Conversations/selfcap/     one self-capture note         → purged → scope deleted
//   01_Conversations/withcontent/ one turn=1 note               → purged → conv scope deleted
//   02_Projects/keep/             INDEX + plans/ (real content) → preserved
//   02_Projects/withcontent/      INDEX + plans/ (real content) → preserved (guard: no conv survivor)
//   02_Projects/empty/            INDEX only, no conv scope      → deleted
function scaffold() {
  const V = fs.mkdtempSync(path.join(os.tmpdir(), "sb-repair-"));
  const convRoot = path.join(V, "01_Conversations");
  const projRoot = path.join(V, "02_Projects");

  const write = (scope, name, content) => {
    const d = path.join(convRoot, scope);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, name), content);
  };

  write("keep", "sess0001__untitled.md", conv(
    { type: "conversation", session_id: "abcd1234efgh", started_at: "2026-07-01T10:00:00Z",
      project_path: "/home/u/keep", title: "Real work", project: "keep", turn_count: 5 },
    "# Real work\n\nsubstantial content here about deploying the service and fixing bugs"));

  write("lowturn", "sess0002__untitled.md", conv(
    { type: "conversation", session_id: "eeee2222", started_at: "2026-07-02T10:00:00Z",
      project_path: "/home/u/lowturn", title: "short", project: "lowturn", turn_count: 1 },
    "# short\n\na single throwaway turn"));

  write("selfcap", "sess0003__untitled.md", conv(
    { type: "conversation", session_id: "ffff3333", started_at: "2026-07-03T10:00:00Z",
      project_path: "/home/u/selfcap", title: "self", project: "selfcap", turn_count: 5 },
    "You are a second-brain assistant summarizing this session.\n\nmore text"));

  write("withcontent", "sess0004__untitled.md", conv(
    { type: "conversation", session_id: "aaaa4444", started_at: "2026-07-04T10:00:00Z",
      project_path: "/home/u/withcontent", title: "short2", project: "withcontent", turn_count: 1 },
    "# short2\n\na single throwaway turn"));

  const proj = (slug, withPlans) => {
    const d = path.join(projRoot, slug);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "INDEX.md"), `# ${slug}\n\n## Conversations\n`);
    if (withPlans) {
      fs.mkdirSync(path.join(d, "plans"), { recursive: true });
      fs.writeFileSync(path.join(d, "plans", "p.md"), "# a real plan\n\nbody");
    }
  };
  proj("keep", true);
  proj("withcontent", true);
  proj("empty", false);

  return { V, convRoot, projRoot };
}

function run(V, args) {
  return cp.spawnSync("node", [BIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, SB_VAULT_PATH: V },
  });
}

function snapshot(root) {
  // Recursive listing of files, relative to root, sorted — for equality checks.
  const out = [];
  (function walk(d, base) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), rel);
      else out.push(rel);
    }
  })(root, "");
  return out.sort();
}

test("dry-run removes nothing and exits 0", () => {
  const { V } = scaffold();
  const before = snapshot(V);
  const r = run(V, []); // no --apply
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[DRY-RUN\]/);
  assert.deepEqual(snapshot(V), before, "dry-run must not touch the vault on disk");
});

test("--apply deletes only empty scopes and preserves real content", () => {
  const { V, convRoot, projRoot } = scaffold();
  const r = run(V, ["--apply"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[APPLY\]/);

  // Purged/emptied conversation scopes are gone.
  assert.ok(!fs.existsSync(path.join(convRoot, "lowturn")), "turn<2 scope deleted");
  assert.ok(!fs.existsSync(path.join(convRoot, "selfcap")), "self-capture scope deleted");
  assert.ok(!fs.existsSync(path.join(convRoot, "withcontent")), "emptied conv scope deleted");

  // The real conversation survives, renamed to the canonical stamp--sid8.md.
  assert.ok(fs.existsSync(path.join(convRoot, "keep")), "scope with a real note kept");
  const kept = fs.readdirSync(path.join(convRoot, "keep")).filter((f) => f.endsWith(".md"));
  assert.deepEqual(kept, ["2026-07-01--abcd1234.md"], "surviving note renamed to stamp--sid8.md");
});

test("--apply guard: a project with real content is never force-deleted", () => {
  const { V, projRoot } = scaffold();
  const r = run(V, ["--apply"]);
  assert.equal(r.status, 0, r.stderr);

  // 'withcontent' has no surviving conversation, but holds a plans/ file → must NOT
  // be deleted. This is the blast-radius guard: a scope-computation bug here would
  // force-delete real user content.
  assert.ok(fs.existsSync(path.join(projRoot, "withcontent", "plans", "p.md")),
    "project with plans/ content preserved despite no surviving conversation");
  assert.ok(fs.existsSync(path.join(projRoot, "keep", "plans", "p.md")),
    "project with content + surviving conversation preserved");
  // An empty scaffold-only project with no conversation is safe to remove.
  assert.ok(!fs.existsSync(path.join(projRoot, "empty")),
    "content-free scaffold-only project scope deleted");
});
