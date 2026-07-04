"use strict";
// Integration test: sb hooks must resolve their skill lib when INSTALLED to
// ~/.claude/hooks — where `__dirname/../lib` is ~/.claude/lib (wrong) and the real lib
// lives at ~/.claude/skills/sb/lib. Regression for the MODULE_NOT_FOUND crash that broke
// every sb hook (capture, session-start/end, plan-mirror, prompt-watch, validate) after
// install.sh copied them out of the repo tree.
// Zero-dep: node:test + node:assert. Run: node --test  (from skills/sb/)

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const REPO_HOOKS = path.join(__dirname, "..", "hooks");
const REPO_LIB = path.join(__dirname, "..", "lib");

// The hooks that require the skill lib at load/run time. lesson-miner-trigger only
// spawns a worker (no lib require); the miner worker is covered indirectly.
const HOOKS = [
  "sb-capture.js", "sb-session-start.js", "sb-session-end.js",
  "sb-plan-mirror.js", "sb-prompt-watch.js", "sb-validate.js",
];

// Build a fake $HOME laid out exactly like a real install: hooks copied to
// ~/.claude/hooks (so __dirname/../lib does NOT exist), lib under ~/.claude/skills/sb/lib
// (the fallback path). os.homedir() honors $HOME on POSIX, so the subprocess resolves
// the fallback against this temp home.
function fakeInstall() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sb-home-"));
  fs.mkdirSync(path.join(home, ".claude", "hooks"), { recursive: true });
  fs.cpSync(REPO_LIB, path.join(home, ".claude", "skills", "sb", "lib"), { recursive: true });
  for (const h of HOOKS) {
    fs.copyFileSync(path.join(REPO_HOOKS, h), path.join(home, ".claude", "hooks", h));
  }
  assert.ok(!fs.existsSync(path.join(home, ".claude", "lib")), "the wrong path must not exist");
  return home;
}

for (const hook of HOOKS) {
  test(`${hook} resolves its lib from the installed hooks dir (no MODULE_NOT_FOUND)`, () => {
    const home = fakeInstall();
    const vault = fs.mkdtempSync(path.join(os.tmpdir(), "sb-vault-"));
    const r = cp.spawnSync("node", [path.join(home, ".claude", "hooks", hook)], {
      input: "{}\n",
      encoding: "utf8",
      env: { ...process.env, HOME: home, SB_VAULT_PATH: vault },
    });
    assert.doesNotMatch(r.stderr || "", /Cannot find module/,
      `${hook} must resolve its lib via the installed fallback; stderr:\n${r.stderr}`);
    assert.equal(r.status, 0, `${hook} should fail open (exit 0); stderr:\n${r.stderr}`);
  });
}
