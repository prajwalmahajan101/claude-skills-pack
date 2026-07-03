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
