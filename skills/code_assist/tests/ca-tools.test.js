"use strict";
// Unit tests for the ca-tools.js backbone. Zero-dependency: node:test + node:assert.
// Run: node --test   (from skills/code_assist/)  or  make test

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ca = require("../bin/ca-tools.js");
const BIN = path.join(__dirname, "..", "bin", "ca-tools.js");

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "ca-test-")); }
function git(dir, ...args) { return cp.spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" }); }
function initRepo() {
  const d = tmp();
  git(d, "init", "-q");
  git(d, "config", "user.email", "t@t.co");
  git(d, "config", "user.name", "t");
  return d;
}

test("classifyFile buckets by path", () => {
  assert.equal(ca.classifyFile("src/a.ts"), "code");
  assert.equal(ca.classifyFile("tests/a_test.go"), "test");
  assert.equal(ca.classifyFile("src/a.test.ts"), "test");
  assert.equal(ca.classifyFile("README.md"), "docs");
  assert.equal(ca.classifyFile("package.json"), "config");
  assert.equal(ca.classifyFile("styles/a.css"), "style");
});

test("coerce parses primitives", () => {
  assert.equal(ca.coerce("true"), true);
  assert.equal(ca.coerce("false"), false);
  assert.equal(ca.coerce("42"), 42);
  assert.equal(ca.coerce("hello"), "hello");
});

test("formatMarkdown never touches fenced code, normalizes prose", () => {
  const src = "# T \n\n\n\nsmart “quote” and —dash\n\n```\nkeep “this” — as-is\n```\n";
  const out = ca.formatMarkdown(src);
  assert.ok(out.includes('smart "quote" and -dash'), "prose normalized");
  assert.ok(out.includes('keep “this” — as-is'), "code block preserved");
  assert.ok(!/\n{3,}/.test(out), "blank lines collapsed");
  assert.ok(!/ \n/.test(out), "no trailing spaces");
});

test("detectStack identifies languages", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "go.mod"), "module x\n");
  const r = ca.detectStack(d);
  assert.ok(r.languages.includes("go"));
  assert.ok(r.stacks.includes("backend"));
});

test("structureAudit scores and finds gaps", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "pyproject.toml"), "[tool.ruff]\n");
  const a = ca.structureAudit(d);
  assert.ok(a.languages || a.detected, "has detection");
  assert.ok(typeof a.compliance_score === "number");
  assert.ok(a.gaps.some((g) => g.path === "README.md"), "flags missing README");
});

test("structureScaffold is idempotent (create then skip)", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "go.mod"), "module x\n");
  const first = ca.structureScaffold(d, "go", true);
  assert.ok(first.planned.some((p) => p.action === "create"), "creates on first run");
  const second = ca.structureScaffold(d, "go", true);
  assert.ok(second.planned.every((p) => p.action.startsWith("skip")), "skips on re-run");
  assert.ok(fs.existsSync(path.join(d, "docs/adr/0000-template.md")));
});

test("track write is dry-run without --confirm (fake env)", async () => {
  process.env.JIRA_BASE_URL = "https://x";
  process.env.JIRA_EMAIL = "a@b.co";
  process.env.JIRA_TOKEN = "tok";
  const r = await ca.track(["comment", "ABC-1", "--text", "hi"]);
  assert.equal(r.dry_run, true, "must not POST without --confirm");
  assert.ok(String(r.would_POST).includes("/comment"));
  delete process.env.JIRA_BASE_URL; delete process.env.JIRA_EMAIL; delete process.env.JIRA_TOKEN;
});

test("notify slack is dry-run without --confirm (fake env)", async () => {
  process.env.SLACK_WEBHOOK_URL = "https://hooks.example/x";
  const r = await ca.notify(["slack", "--text", "hi"]);
  assert.equal(r.dry_run, true);
  delete process.env.SLACK_WEBHOOK_URL;
});

test("track/notify no-op with a hint when unconfigured", async () => {
  const saved = { ...process.env };
  delete process.env.JIRA_BASE_URL; delete process.env.JIRA_EMAIL; delete process.env.JIRA_TOKEN;
  delete process.env.SLACK_WEBHOOK_URL;
  const t = await ca.track(["get", "ABC-1"]);
  assert.equal(t.configured, false);
  assert.ok(t.hint);
  const n = await ca.notify(["slack", "--text", "hi"]);
  assert.equal(n.configured, false);
  Object.assign(process.env, saved);
});

test("changelog groups conventional commits since last tag", () => {
  const d = initRepo();
  fs.writeFileSync(path.join(d, "a"), "1");
  git(d, "add", "a"); git(d, "commit", "-q", "-m", "feat: add a");
  fs.writeFileSync(path.join(d, "b"), "1");
  git(d, "add", "b"); git(d, "commit", "-q", "-m", "fix: fix b");
  const c = ca.changelog(d);
  assert.ok(c.groups.Added && c.groups.Added.length >= 1, "feat -> Added");
  assert.ok(c.groups.Fixed && c.groups.Fixed.length >= 1, "fix -> Fixed");
});

test("versionDetect reads package.json", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ version: "1.2.3" }));
  const v = ca.versionDetect(d);
  assert.equal(v.source, "package.json");
  assert.equal(v.version, "1.2.3");
});

test("selfcheck reports structured booleans, never throws", () => {
  const s = ca.selfcheck();
  assert.ok(s.tools && s.integrations && s.siblings);
  assert.equal(typeof s.integrations.jira, "boolean");
});

test("CLI dispatch emits valid JSON for version", () => {
  const r = cp.spawnSync("node", [BIN, "version"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.equal(j.name, "ca-tools");
});

// --- reverse bridge (recall) -------------------------------------------------
function seedStores() {
  const d = tmp();
  fs.mkdirSync(path.join(d, "lessons"));
  fs.mkdirSync(path.join(d, "mem"));
  fs.mkdirSync(path.join(d, "remember"));
  fs.writeFileSync(path.join(d, "lessons", "INDEX.md"),
    "# Lessons\n\n- `x.md` — [risk] Never commit AWS keys; use env vars and rotate on leak\n" +
    "- `y.md` — [tooling] pytest fixtures for database isolation\n");
  fs.writeFileSync(path.join(d, "mem", "MEMORY.md"),
    "# MEMORY\n\n- [Git rules](g.md) — no commits to main; conventional commits; rebase merge\n");
  fs.writeFileSync(path.join(d, "remember", "recent.md"), "# Recent\n\n- built the recall subcommand today\n");
  return d;
}
function withStores(d, fn) {
  const saved = { l: process.env.CA_LESSONS_DIR, m: process.env.CA_MEMORY_DIR, r: process.env.CA_REMEMBER_DIR, s: process.env.CA_RECALL_SB };
  process.env.CA_LESSONS_DIR = path.join(d, "lessons");
  process.env.CA_MEMORY_DIR = path.join(d, "mem");
  process.env.CA_REMEMBER_DIR = path.join(d, "remember");
  process.env.CA_RECALL_SB = "0"; // deterministic: skip sb enrichment
  try { return fn(); } finally {
    saved.l === undefined ? delete process.env.CA_LESSONS_DIR : process.env.CA_LESSONS_DIR = saved.l;
    saved.m === undefined ? delete process.env.CA_MEMORY_DIR : process.env.CA_MEMORY_DIR = saved.m;
    saved.r === undefined ? delete process.env.CA_REMEMBER_DIR : process.env.CA_REMEMBER_DIR = saved.r;
    saved.s === undefined ? delete process.env.CA_RECALL_SB : process.env.CA_RECALL_SB = saved.s;
  }
}

test("recall surfaces relevant lessons + risks with provenance (tier-1, sb off)", () => {
  const d = seedStores();
  withStores(d, () => {
    const r = ca.recall(["--context", "committing secrets to git", "--limit", "5"]);
    assert.ok(r.lessons.length >= 1, "finds the secret-commit lesson");
    assert.ok(r.risks.length >= 1, "flags it as a risk");
    assert.match(r.risks[0].text, /Never commit AWS keys/);
    const all = [...r.lessons, ...r.risks, ...r.memory];
    assert.ok(all.every((x) => x.ref && /:\d+$/.test(x.ref)), "every item carries a file:line ref (provenance)");
  });
});

test("recall ranks by relevance and never fabricates (irrelevant context → no forced hits)", () => {
  const d = seedStores();
  withStores(d, () => {
    const r = ca.recall(["--context", "kubernetes helm chart rollout", "--limit", "5"]);
    // none of the seeded items mention k8s — recall must not invent matches.
    assert.equal(r.lessons.length, 0, "no lesson matches an unrelated context");
    assert.equal(r.risks.length, 0);
    assert.equal(r.sources.lessons, 2, "but the store was still read (2 lessons on disk)");
  });
});

test("recall is bounded by --limit", () => {
  const d = seedStores();
  withStores(d, () => {
    const r = ca.recall(["--context", "commit git secrets database pytest", "--limit", "1"]);
    assert.ok(r.lessons.length <= 1, "respects --limit");
  });
});

test("bridge status exposes the pull (reverse) channel", () => {
  const d = seedStores();
  withStores(d, () => {
    const b = ca.bridge(["status"]);
    assert.ok(b.pull && b.pull.available === true, "pull channel advertised");
    assert.equal(b.pull.sources.lessons, 2);
  });
});

// --- secure family -----------------------------------------------------------
test("secretScan detects real secrets, masks values, skips placeholders + allowlist", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "a.py"),
    'aws = "AKIAIOSFODNN7EXAMPLE"\n' +
    'password = "s3cr3tP@ssw0rd123"\n' +
    'safe = os.getenv("TOKEN")\n' +
    'gk = "AIzaSyDReal35charGoogleKeyAbcdefghijklmno"  # ca:allow-secret\n');
  const r = ca.secretScan([path.join(d, "a.py")]);
  const rules = r.findings.map((f) => f.rule);
  assert.ok(rules.includes("aws-access-key"), "catches AWS key");
  assert.ok(rules.includes("generic-secret"), "catches password=");
  assert.ok(!rules.some((x) => x === "google-api-key"), "allowlisted line skipped");
  assert.ok(r.findings.every((f) => f.masked.includes("*")), "values are masked");
  assert.ok(!JSON.stringify(r).includes("AKIAIOSFODNN7EXAMPLE"), "raw secret never emitted");
});

test("secretScan --staged reads staged blobs in a repo", () => {
  const d = initRepo();
  fs.writeFileSync(path.join(d, "deploy.sh"), "KEY=AKIAIOSFODNN7EXAMPLE\n");
  git(d, "add", "deploy.sh");
  const r = ca.secretScan(["--staged", "--dir", d]);
  assert.equal(r.mode, "staged");
  assert.ok(r.count >= 1 && r.findings[0].rule === "aws-access-key");
});

test("installGitHooks is dry-run by default, applies + sets hooksPath, and is idempotent", () => {
  const d = initRepo();
  const dry = ca.installGitHooks([d]);
  assert.equal(dry.apply, false, "dry-run by default");
  assert.ok(!fs.existsSync(path.join(d, ".githooks", "pre-commit")), "writes nothing on dry-run");
  const applied = ca.installGitHooks([d, "--apply"]);
  assert.equal(applied.apply, true);
  assert.ok(fs.existsSync(path.join(d, ".githooks", "pre-commit")), "pre-commit written");
  assert.equal((fs.statSync(path.join(d, ".githooks", "pre-commit")).mode & 0o111) !== 0, true, "executable");
  assert.equal(git(d, "config", "--get", "core.hooksPath").stdout.trim(), ".githooks");
  const again = ca.installGitHooks([d, "--apply"]);
  assert.ok(again.planned.every((p) => String(p.action).startsWith("skip")), "idempotent re-apply");
  const un = ca.uninstallGitHooks([d, "--apply"]);
  assert.equal(un.unset, true);
  assert.equal(git(d, "config", "--get", "core.hooksPath").stdout.trim(), "", "hooksPath reverted");
});

test("envCheck reports missing + extra keys, never values", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, ".env.example"), "DB_URL=\nAPI_KEY=\nPORT=\n");
  fs.writeFileSync(path.join(d, ".env"), "DB_URL=secretvalue\nPORT=3000\nEXTRA=y\n");
  const r = ca.envCheck(d);
  assert.deepEqual(r.missing, ["API_KEY"]);
  assert.deepEqual(r.extra, ["EXTRA"]);
  assert.ok(!JSON.stringify(r).includes("secretvalue"), "values never surfaced");
});
