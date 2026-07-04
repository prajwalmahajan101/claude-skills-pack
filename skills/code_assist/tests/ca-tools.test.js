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
  assert.ok(s.tools && s.integrations);
  assert.equal(typeof s.integrations.jira, "boolean");
});

test("CLI dispatch emits valid JSON for version", () => {
  const r = cp.spawnSync("node", [BIN, "version"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.equal(j.name, "ca-tools");
});

// --- recall (harness stores) -------------------------------------------------
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
  const saved = { l: process.env.CA_LESSONS_DIR, m: process.env.CA_MEMORY_DIR, r: process.env.CA_REMEMBER_DIR };
  process.env.CA_LESSONS_DIR = path.join(d, "lessons");
  process.env.CA_MEMORY_DIR = path.join(d, "mem");
  process.env.CA_REMEMBER_DIR = path.join(d, "remember");
  try { return fn(); } finally {
    saved.l === undefined ? delete process.env.CA_LESSONS_DIR : process.env.CA_LESSONS_DIR = saved.l;
    saved.m === undefined ? delete process.env.CA_MEMORY_DIR : process.env.CA_MEMORY_DIR = saved.m;
    saved.r === undefined ? delete process.env.CA_REMEMBER_DIR : process.env.CA_REMEMBER_DIR = saved.r;
  }
}

test("recall surfaces relevant lessons + risks with provenance (harness stores)", () => {
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

// --- graph review-prep (blast-radius grounding) ------------------------------
test("extractSymbols pulls definitions per language", () => {
  const js = "export function alpha(){}\nclass Beta {}\nconst gamma = async () => {}\nconst notFn = 3;";
  const s = ca.extractSymbols(js, "src/x.ts");
  assert.ok(s.includes("alpha") && s.includes("Beta") && s.includes("gamma"), JSON.stringify(s));
  assert.ok(!s.includes("notFn"), "non-callable const not captured");
  const py = "def do_thing():\n    pass\nclass Widget:\n    pass\n";
  const p = ca.extractSymbols(py, "m.py");
  assert.deepEqual(p.sort(), ["Widget", "do_thing"]);
  assert.deepEqual(ca.extractSymbols("whatever", "README.md"), [], "unknown ext → none");
});

test("parseImpact reads count + risk from gitnexus-style output", () => {
  assert.deepEqual(ca.parseImpact("impactedCount: 65, risk: HIGH"), { impactedCount: 65, risk: "HIGH" });
  assert.deepEqual(ca.parseImpact("12 dependants found\nRisk MEDIUM"), { impactedCount: 12, risk: "MEDIUM" });
  assert.deepEqual(ca.parseImpact("no numbers here"), { impactedCount: null, risk: null });
});

test("review-prep lists changed files + candidate symbols (degrades without gitnexus)", () => {
  const d = initRepo();
  fs.writeFileSync(path.join(d, "svc.js"), "export function handlePayment(){}\nclass Ledger {}\n");
  git(d, "add", "svc.js");
  const r = ca.reviewPrep(["--dir", d]); // note: reviewPrep reads f._[0], so pass dir positionally
  const r2 = ca.reviewPrep([d]);
  assert.equal(r2.ok, true);
  assert.ok(r2.changedFiles.includes("svc.js"), JSON.stringify(r2.changedFiles));
  // gitnexus may or may not be installed; either shape is valid, but symbols must be discoverable.
  const syms = r2.available ? r2.blastRadius.map((b) => b.symbol) : r2.candidateSymbols;
  if (!r2.available) assert.ok(syms.includes("handlePayment") && syms.includes("Ledger"), JSON.stringify(r2));
  assert.ok(typeof r2.note === "string");
});

test("review-prep rejects a non-repo directory", () => {
  const d = tmp();
  const r = ca.reviewPrep([d]);
  assert.equal(r.ok, false);
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

test("secretScan catches compound-identifier secret names (db_secret, secret_token)", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "c.env"), 'db_secret = "abcd1234efgh5678"\nsecret_token="zzzz9999yyyy8888"\nX_AUTH_TOKEN=qwer1234asdf5678\n');
  const r = ca.secretScan([path.join(d, "c.env")]);
  assert.ok(r.count >= 3, "matches db_secret, secret_token, X_AUTH_TOKEN");
});

test("secretScan honors a .ca-secretsignore next to the scanned file (paths mode)", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "cfg.py"), 'aws = "AKIAIOSFODNN7EXAMPLE"\n');
  fs.writeFileSync(path.join(d, ".ca-secretsignore"), "AKIAIOSFODNN7EXAMPLE\n");
  const r = ca.secretScan([path.join(d, "cfg.py")]);
  assert.equal(r.count, 0, "per-file ignorefile suppresses the finding");
});

test("secretScan --staged reads staged blobs in a repo", () => {
  const d = initRepo();
  fs.writeFileSync(path.join(d, "deploy.sh"), "KEY=AKIAIOSFODNN7EXAMPLE\n");
  git(d, "add", "deploy.sh");
  const r = ca.secretScan(["--staged", "--dir", d]);
  assert.equal(r.mode, "staged");
  assert.ok(r.count >= 1 && r.findings[0].rule === "aws-access-key");
  assert.equal(r.truncated, 0, "no cap by default");
});

test("secretScan --range scans the range's ref, not the working tree", () => {
  const d = initRepo();
  git(d, "commit", "-q", "--allow-empty", "-m", "base");
  const base = git(d, "rev-parse", "HEAD").stdout.trim();
  fs.writeFileSync(path.join(d, "cfg.sh"), "KEY=AKIAIOSFODNN7EXAMPLE\n");
  git(d, "add", "cfg.sh");
  git(d, "commit", "-q", "-m", "add secret");
  // Scrub the secret from the working tree — a working-tree read would now miss it.
  fs.writeFileSync(path.join(d, "cfg.sh"), "KEY=redacted\n");
  const r = ca.secretScan(["--range", `${base}..HEAD`, "--dir", d]);
  assert.ok(r.count >= 1 && r.findings.some((x) => x.rule === "aws-access-key"),
    "secret found from the committed ref despite the scrubbed working tree");
});

test("secretScan --max-files caps the staged set and reports the truncation", () => {
  const d = initRepo();
  for (let i = 0; i < 4; i++) {
    fs.writeFileSync(path.join(d, `f${i}.txt`), `line ${i}\n`);
    git(d, "add", `f${i}.txt`);
  }
  const r = ca.secretScan(["--staged", "--dir", d, "--max-files", "2", "--no-tools"]);
  assert.equal(r.scanned, 2, "only the cap is scanned");
  assert.equal(r.truncated, 2, "remaining files reported as truncated, not silently dropped");
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

test("incidentScaffold numbers sequentially from the release tag, idempotent-safe", () => {
  const d = initRepo();
  git(d, "commit", "-q", "--allow-empty", "-m", "init");
  git(d, "tag", "v2.0.0");
  const dry = ca.incidentScaffold(["--title", "checkout 500s", "--dir", d]);
  assert.equal(dry.number, "0001");
  assert.equal(dry.base_tag, "v2.0.0", "reports the release tag as hotfix base");
  assert.equal(dry.written, false, "dry-run by default");
  const w1 = ca.incidentScaffold(["--title", "checkout 500s", "--dir", d, "--apply"]);
  assert.ok(w1.written && fs.existsSync(path.join(d, w1.file)));
  const w2 = ca.incidentScaffold(["--title", "cache stampede", "--dir", d, "--apply"]);
  assert.equal(w2.number, "0002", "next incident increments");
  // re-scaffolding the SAME topic warns (likely duplicate) instead of minting a silent new record
  const dup = ca.incidentScaffold(["--title", "checkout 500s", "--dir", d, "--apply"]);
  assert.equal(dup.ok, false, "duplicate topic is flagged, not silently numbered");
  assert.match(dup.existing, /0001-checkout-500s\.md$/);
  // --force overrides to a fresh distinct record
  const forced = ca.incidentScaffold(["--title", "checkout 500s", "--dir", d, "--apply", "--force"]);
  assert.equal(forced.number, "0003", "--force writes a new numbered record");
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
