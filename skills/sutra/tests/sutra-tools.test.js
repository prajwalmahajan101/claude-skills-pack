"use strict";
// Unit tests for the sutra-tools.js orchestrator backbone.
// Zero-dependency: node:test + node:assert.  Run: node --test  (from skills/sutra/)  or  make test

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const sutra = require("../bin/sutra-tools.js");
const BIN = path.join(__dirname, "..", "bin", "sutra-tools.js");

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "sutra-test-")); }

// Build a fake installed-skills root containing exactly the given member ids,
// each with a plugin.json declaring a version. Returns the root path.
function fakeSkills(members) {
  const root = tmp();
  for (const [id, version] of Object.entries(members)) {
    const dir = path.join(root, id, ".claude-plugin");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify({ name: id, version }));
  }
  return root;
}

// Write an executable node CLI stub inside a fake member (so recall composition can
// be tested without the real members). scriptBody is the JS printed to stdout.
function fakeMemberCli(root, id, relParts, scriptBody) {
  const p = path.join(root, id, ...relParts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, scriptBody);
  return p;
}

// Run an in-process helper with SUTRA_SKILLS_DIR pinned, restoring env after.
function withSkills(root, fn) {
  const prev = process.env.SUTRA_SKILLS_DIR;
  process.env.SUTRA_SKILLS_DIR = root;
  try { return fn(); } finally { process.env.SUTRA_SKILLS_DIR = prev; }
}

// Run the CLI with a pinned skills root; return parsed JSON stdout.
function runCLI(args, skillsDir) {
  const r = cp.spawnSync("node", [BIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, SUTRA_SKILLS_DIR: skillsDir || "" },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("registry lists every declared member from members.json", () => {
  const root = fakeSkills({});
  const prev = process.env.SUTRA_SKILLS_DIR;
  process.env.SUTRA_SKILLS_DIR = root; // pinned + empty → nothing present
  try {
    const reg = sutra.registry();
    const ids = reg.members.map((m) => m.id).sort();
    assert.deepEqual(ids, ["code_assist", "sb", "unabridged"], "all three members declared");
    assert.deepEqual(reg.present, [], "none present when pinned root is empty");
    for (const m of reg.members) assert.equal(m.present, false);
  } finally { process.env.SUTRA_SKILLS_DIR = prev; }
});

test("registry resolves presence + version from a pinned skills root", () => {
  const root = fakeSkills({ code_assist: "0.6.0", sb: "0.9.1" }); // unabridged absent
  const prev = process.env.SUTRA_SKILLS_DIR;
  process.env.SUTRA_SKILLS_DIR = root;
  try {
    const reg = sutra.registry();
    assert.deepEqual(reg.present.sort(), ["code_assist", "sb"]);
    const byId = Object.fromEntries(reg.members.map((m) => [m.id, m]));
    assert.equal(byId.code_assist.present, true);
    assert.equal(byId.code_assist.version, "0.6.0");
    assert.equal(byId.code_assist.mode, "installed");
    assert.equal(byId.sb.version, "0.9.1");
    assert.equal(byId.unabridged.present, false);
    assert.equal(byId.unabridged.version, null);
  } finally { process.env.SUTRA_SKILLS_DIR = prev; }
});

test("memberFor routes a capability to its present owning member", () => {
  const root = fakeSkills({ code_assist: "0.6.0", sb: "0.9.1" });
  const prev = process.env.SUTRA_SKILLS_DIR;
  process.env.SUTRA_SKILLS_DIR = root;
  try {
    assert.equal(sutra.memberFor("commit").id, "code_assist");
    assert.equal(sutra.memberFor("kanban").id, "sb");
    assert.equal(sutra.memberFor("no-such-capability"), null);
  } finally { process.env.SUTRA_SKILLS_DIR = prev; }
});

test("memberFor returns null when the owning member is absent", () => {
  const root = fakeSkills({ sb: "0.9.1" }); // code_assist absent
  const prev = process.env.SUTRA_SKILLS_DIR;
  process.env.SUTRA_SKILLS_DIR = root;
  try {
    assert.equal(sutra.memberFor("commit"), null, "commit's owner (code_assist) is absent");
    assert.equal(sutra.memberFor("kanban").id, "sb");
  } finally { process.env.SUTRA_SKILLS_DIR = prev; }
});

test("CLI dispatch emits valid JSON for registry and version", () => {
  const root = fakeSkills({ code_assist: "0.6.0" });
  const reg = runCLI(["registry"], root);
  assert.deepEqual(reg.present, ["code_assist"]);
  const ver = runCLI(["version"], root);
  assert.equal(ver.name, "sutra-tools");
  assert.match(ver.version, /^\d+\.\d+\.\d+$/);
});

test("selfcheck summarizes the pack without throwing", () => {
  const root = fakeSkills({ code_assist: "0.6.0", unabridged: "1.0.0" });
  const sc = runCLI(["selfcheck"], root);
  assert.equal(sc.name, "sutra");
  assert.deepEqual(sc.present.sort(), ["code_assist", "unabridged"]);
});

// --- schema conformance -----------------------------------------------------
const GOOD_FIXTURE = path.join(__dirname, "..", "schema", "conformance", "good-repo");

// Copy a dir tree into a fresh (non-git) tmp dir so schemaCheck's repoRoot
// resolves to the copy, not the enclosing sutra repo.
function stageRepo(fixture) {
  const d = tmp();
  fs.cpSync(fixture, d, { recursive: true });
  return d;
}

test("schema-check passes on the good-repo fixture", () => {
  const repo = stageRepo(GOOD_FIXTURE);
  const res = sutra.schemaCheck(repo);
  assert.equal(res.ok, true, JSON.stringify(res, null, 2));
  assert.equal(res.journal.conforming, 1);
  assert.equal(res.adr.conforming, 1);
  assert.equal(res.review.found, 1);
  assert.equal(res.review.violations.length, 0, "resolved malformed issue is ignored");
});

test("schema-check flags a journal missing its M<phase> H1", () => {
  const repo = stageRepo(GOOD_FIXTURE);
  fs.writeFileSync(path.join(repo, ".journal", "M2.0.md"), "# not a phase header\n\nbody\n");
  const res = sutra.schemaCheck(repo);
  assert.equal(res.ok, false);
  assert.ok(res.journal.violations.some((v) => v.includes("M2.0.md")));
});

test("schema-check flags an ADR missing a required section", () => {
  const repo = stageRepo(GOOD_FIXTURE);
  fs.writeFileSync(path.join(repo, "docs", "adr", "0002-broken.md"),
    "# 2. Broken\n\n- Status: accepted\n- Date: 2026-07-04\n\n## Context\nx\n## Decision\ny\n");
  const res = sutra.schemaCheck(repo);
  assert.equal(res.ok, false);
  assert.ok(res.adr.violations.some((v) => v.includes("Consequences")));
});

test("schema-check flags an active issue with no Severity/Priority", () => {
  const repo = stageRepo(GOOD_FIXTURE);
  const p = path.join(repo, ".code_review", "code_review_issues.md");
  fs.writeFileSync(p, "# Issues\n\n### ISSUE-009 — no metadata\n\njust a description\n");
  const res = sutra.schemaCheck(repo);
  assert.equal(res.ok, false);
  assert.ok(res.review.violations.some((v) => v.includes("ISSUE-009")));
});

test("schema-check is clean (not violating) when no artifacts exist", () => {
  const repo = tmp();
  const res = sutra.schemaCheck(repo);
  assert.equal(res.ok, true);
  assert.equal(res.journal.found, 0);
  assert.equal(res.adr.found, 0);
  assert.equal(res.review.found, 0);
});

// --- bridge core: sync-artifacts / bridge status / recall / loop-emit --------
test("sync-artifacts builds a vault payload from repo artifacts", () => {
  const repo = stageRepo(GOOD_FIXTURE);
  const res = withSkills(fakeSkills({ sb: "0.9.1" }), () => sutra.syncArtifacts(repo));
  assert.equal(res.ok, true);
  assert.equal(res.consumer.sb, true);
  const types = res.notes.map((n) => n.type).sort();
  assert.deepEqual([...new Set(types)].sort(), ["code-review", "decision", "journal"]);
  assert.equal(res.counts.journals, 1);
  assert.equal(res.counts.adrs, 1);
  assert.equal(res.openIssues.length, 2, "two active issues, resolved one excluded");
  assert.ok(res.openIssues.every((i) => ["critical", "high", "medium", "low"].includes(i.severity)));
});

test("sync-artifacts notes sb-absent but still builds the payload", () => {
  const repo = stageRepo(GOOD_FIXTURE);
  const res = withSkills(fakeSkills({}), () => sutra.syncArtifacts(repo));
  assert.equal(res.consumer.sb, false);
  assert.ok(res.notes.length > 0, "payload built even without sb");
});

test("bridge status reflects which members are present", () => {
  const full = withSkills(fakeSkills({ code_assist: "0.6.0", sb: "0.9.1", unabridged: "1.0.0" }), () => sutra.bridge(["status"]));
  assert.deepEqual(full.present.sort(), ["code_assist", "sb", "unabridged"]);
  assert.equal(full.handoffs["recall-fusion"].available, true);
  const none = withSkills(fakeSkills({}), () => sutra.bridge(["status"]));
  assert.deepEqual(none.present, []);
  assert.equal(none.handoffs["recall-fusion"].available, false);
});

test("recall composes code_assist base + sb vault highlights, deduped", () => {
  const root = fakeSkills({ code_assist: "0.6.0", sb: "0.9.1" });
  fakeMemberCli(root, "code_assist", ["bin", "ca-tools.js"],
    'process.stdout.write(JSON.stringify({lessons:[{text:"prefer rebase",ref:"L:1"}],risks:[{text:"never force-push main",ref:"L:2"}],memory:[]}))');
  fakeMemberCli(root, "sb", ["commands", "_runners", "ask-highlights.js"],
    'process.stdout.write("•  vault insight one\\n  — v:10\\n•  prefer rebase\\n  — v:11\\n")');
  const res = withSkills(root, () => sutra.recallFused(["--context", "git workflow"]));
  assert.equal(res.sources.code_assist, true);
  assert.equal(res.sources.sb, true);
  const texts = res.lessons.map((l) => l.text);
  assert.ok(texts.includes("prefer rebase"), "base lesson present");
  assert.ok(texts.includes("vault insight one"), "vault highlight merged");
  assert.equal(texts.filter((t) => t === "prefer rebase").length, 1, "deduped by text");
  assert.ok(res.risks.some((r) => r.text.includes("force-push")), "risks carried from base");
});

test("recall returns empty (never fabricates) when no members are present", () => {
  const res = withSkills(fakeSkills({}), () => sutra.recallFused(["--context", "anything"]));
  assert.equal(res.sources.code_assist, false);
  assert.equal(res.sources.sb, false);
  assert.deepEqual(res.lessons, []);
  assert.deepEqual(res.risks, []);
});

test("recall composes from code_assist alone when sb is absent", () => {
  const root = fakeSkills({ code_assist: "0.6.0" }); // sb absent
  fakeMemberCli(root, "code_assist", ["bin", "ca-tools.js"],
    'process.stdout.write(JSON.stringify({lessons:[{text:"prefer rebase",ref:"L:1"}],risks:[],memory:[]}))');
  const res = withSkills(root, () => sutra.recallFused(["--context", "git"]));
  assert.equal(res.sources.code_assist, true);
  assert.equal(res.sources.sb, false);
  assert.deepEqual(res.lessons.map((l) => l.text), ["prefer rebase"]);
});

test("recall composes from sb vault alone when code_assist is absent", () => {
  const root = fakeSkills({ sb: "0.9.1" }); // code_assist absent
  fakeMemberCli(root, "sb", ["commands", "_runners", "ask-highlights.js"],
    'process.stdout.write("•  vault insight one\\n  — v:10\\n")');
  const res = withSkills(root, () => sutra.recallFused(["--context", "insight"]));
  assert.equal(res.sources.code_assist, false);
  assert.equal(res.sources.sb, true);
  assert.deepEqual(res.lessons.map((l) => l.text), ["vault insight one"]);
});

test("recall orders cross-source ties deterministically (base before sb by rank)", () => {
  const root = fakeSkills({ code_assist: "0.6.0", sb: "0.9.1" });
  fakeMemberCli(root, "code_assist", ["bin", "ca-tools.js"],
    'process.stdout.write(JSON.stringify({lessons:[{text:"base one"},{text:"base two"}],risks:[],memory:[]}))');
  fakeMemberCli(root, "sb", ["commands", "_runners", "ask-highlights.js"],
    'process.stdout.write("•  sb one\\n  — v:1\\n•  sb two\\n  — v:2\\n")');
  // Context overlaps nothing → all scores 0 → ordering falls entirely to member rank.
  const res = withSkills(root, () => sutra.recallFused(["--context", "zzzznomatch"]));
  assert.deepEqual(res.lessons.map((l) => l.text), ["base one", "base two", "sb one", "sb two"],
    "base lessons rank ahead of sb hits deterministically (no _rank collision)");
});

test("recall surfaces a warning when a member returns unparseable JSON", () => {
  const root = fakeSkills({ code_assist: "0.6.0" });
  fakeMemberCli(root, "code_assist", ["bin", "ca-tools.js"], 'process.stdout.write("not json{{{")');
  const res = withSkills(root, () => sutra.recallFused(["--context", "anything"]));
  assert.equal(res.sources.code_assist, true);
  assert.ok(res.warnings.some((w) => /unparseable JSON/.test(w)), "warning surfaced instead of silent empty");
  assert.deepEqual(res.lessons, []);
});

test("recall surfaces a warning when a member exits non-zero", () => {
  const root = fakeSkills({ code_assist: "0.6.0" });
  fakeMemberCli(root, "code_assist", ["bin", "ca-tools.js"], 'process.exit(3)');
  const res = withSkills(root, () => sutra.recallFused(["--context", "anything"]));
  assert.ok(res.warnings.some((w) => /code_assist recall failed/.test(w)), "non-zero exit reported");
});

test("bridge rejects a non-status subcommand with a usage error", () => {
  const res = withSkills(fakeSkills({}), () => sutra.bridge(["frobnicate"]));
  assert.equal(res.ok, false);
  assert.match(res.reason, /usage: bridge <status>/);
});

test("loop-emit rejects a missing --event with a usage error", () => {
  const res = withSkills(fakeSkills({}), () => sutra.loopEmit(["--note", "orphan"]));
  assert.equal(res.ok, false);
  assert.match(res.reason, /usage: loop-emit/);
});

test("resolveMember falls back to the dev-checkout sibling when not installed", () => {
  // Point HOME at an empty temp home (no ~/.claude/skills) and unpin SUTRA_SKILLS_DIR
  // so the installed lookup misses and the PACK_ROOT dev sibling is used instead.
  const home = tmp();
  const prevHome = process.env.HOME;
  const prevPin = process.env.SUTRA_SKILLS_DIR;
  process.env.HOME = home;
  delete process.env.SUTRA_SKILLS_DIR;
  try {
    const r = sutra.resolveMember("sb");
    assert.ok(r, "sb resolves from the repo checkout");
    assert.equal(r.mode, "dev");
    assert.equal(path.basename(r.dir), "sb");
  } finally {
    process.env.HOME = prevHome;
    if (prevPin === undefined) delete process.env.SUTRA_SKILLS_DIR;
    else process.env.SUTRA_SKILLS_DIR = prevPin;
  }
});

test("memberVersion returns null for a malformed or version-less plugin.json", () => {
  const bad = tmp();
  fs.mkdirSync(path.join(bad, ".claude-plugin"), { recursive: true });
  fs.writeFileSync(path.join(bad, ".claude-plugin", "plugin.json"), "{ not valid json");
  assert.equal(sutra.memberVersion(bad), null, "unparseable plugin.json → null");

  const noVer = tmp();
  fs.mkdirSync(path.join(noVer, ".claude-plugin"), { recursive: true });
  fs.writeFileSync(path.join(noVer, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "x" }));
  assert.equal(sutra.memberVersion(noVer), null, "missing version field → null");
});

// --- payload↔ingest contract: sutra builds, sb's REAL ingest.js consumes -------
// This is the seam that replaced the old bridge. sutra owns the mapping; sb owns
// the write. If either side drifts (a renamed payload key, a changed note shape),
// this test fails where a structural key-match test would silently pass.
const SB_INGEST = path.join(__dirname, "..", "..", "sb", "commands", "_runners", "ingest.js");

test("sync-artifacts payload feeds sb's ingest.js and lands notes + open issues", () => {
  const repo = stageRepo(GOOD_FIXTURE);
  const payload = withSkills(fakeSkills({ sb: "0.9.1" }), () => sutra.syncArtifacts(repo));
  assert.ok(payload.notes.length > 0 && payload.project, "producer built a usable payload");

  const payloadFile = path.join(tmp(), "payload.json");
  fs.writeFileSync(payloadFile, JSON.stringify(payload));
  const vault = tmp();
  const r = cp.spawnSync("node", [SB_INGEST, "--payload", payloadFile], {
    encoding: "utf8",
    env: { ...process.env, SB_VAULT_PATH: vault },
  });
  assert.equal(r.status, 0, r.stderr);

  const projDir = path.join(vault, "02_Projects", payload.project);
  assert.ok(fs.existsSync(path.join(projDir, "journal")), "journal notes landed");
  assert.ok(fs.existsSync(path.join(projDir, "decisions")), "decision notes landed");
  const index = fs.readFileSync(path.join(projDir, "INDEX.md"), "utf8");
  assert.match(index, /## Open review issues/, "open issues surfaced in the project index");
  assert.match(index, new RegExp(`${payload.openIssues.length} open`), "issue count matches the payload");
});

test("loop-emit appends a durable feedback event", () => {
  // Always pin --dir to a tmp dir so the test never writes into the real repo.
  const repo = tmp(), repo2 = tmp();
  const res = withSkills(fakeSkills({ sb: "0.9.1" }), () => sutra.loopEmit(["--event", "verify", "--note", "tests pass", "--risk", "--dir", repo2]));
  assert.equal(res.ok, true, "risk event logged");
  assert.notEqual(res.suggest, null, "sb present → promote suggestion");
  const res2 = withSkills(fakeSkills({}), () => sutra.loopEmit(["--event", "incident", "--note", "outage", "--dir", repo]));
  assert.equal(res2.ok, true);
  assert.ok(fs.existsSync(res2.logged));
  const lines = fs.readFileSync(res2.logged, "utf8").trim().split("\n");
  const last = JSON.parse(lines[lines.length - 1]);
  assert.equal(last.event, "incident");
  assert.equal(last.note, "outage");
  assert.ok(last.ts, "timestamped");
  assert.equal(res2.suggest, null, "no sb → no promote suggestion");
});
