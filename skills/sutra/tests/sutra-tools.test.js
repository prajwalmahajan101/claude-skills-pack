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
