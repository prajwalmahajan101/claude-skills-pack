"use strict";
// Integration tests for sb's vault layer against a throwaway SB_VAULT_PATH vault.
// Zero-dep: node:test + node:assert. Covers the session-map read-modify-write path
// (the highest-risk stateful surface) and note write/update round-trips.
// Run: node --test  (from skills/sb/)

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Each test pins a fresh vault BEFORE requiring vault.js (VAULT is read at load),
// so we load it per-test via a cache-busting require.
function freshVault() {
  const V = fs.mkdtempSync(path.join(os.tmpdir(), "sb-vault-"));
  process.env.SB_VAULT_PATH = V;
  delete require.cache[require.resolve("../lib/vault.js")];
  return { V, vault: require("../lib/vault.js") };
}

test("updateSessionMap merges concurrent-key writes without clobbering (H3 regression)", () => {
  const { V, vault } = freshVault();
  vault.updateSessionMap((m) => { m.A = { byteOffset: 10, turnCount: 1, status: "active" }; });
  vault.updateSessionMap((m) => { m.B = { byteOffset: 20, turnCount: 2, status: "active" }; });
  vault.updateSessionMap((m) => { m.A.turnCount = 5; }); // re-read must see committed A
  const map = vault.readSessionMap();
  assert.equal(map.A.turnCount, 5, "second update saw the committed first write");
  assert.deepEqual(map.B, { byteOffset: 20, turnCount: 2, status: "active" }, "different-key write not dropped");
  assert.ok(!fs.existsSync(path.join(V, "_meta", "session-map.json.lock")), "lock released");
});

test("writeJSON is atomic (no leftover temp files)", () => {
  const { V, vault } = freshVault();
  const f = path.join(V, "_meta", "x.json");
  vault.writeJSON(f, { a: 1 });
  assert.deepEqual(vault.readJSON(f, null), { a: 1 });
  const leftovers = fs.readdirSync(path.join(V, "_meta")).filter((n) => n.includes(".tmp"));
  assert.deepEqual(leftovers, [], "no .tmp files left behind");
});

test("markSessionEnded preserves the capture offset while ending the session", () => {
  const { vault } = freshVault();
  // Simulate a capture having written an offset...
  vault.updateSessionMap((m) => { m.S1 = { byteOffset: 999, turnCount: 7, status: "active", file: null }; });
  // ...then the session-end hook marks it ended.
  const ok = vault.markSessionEnded("S1", "clean-exit");
  assert.equal(ok, true);
  const e = vault.readSessionMap().S1;
  assert.equal(e.status, "ended");
  assert.equal(e.endedReason, "clean-exit");
  assert.equal(e.byteOffset, 999, "capture offset not clobbered by the end-marker");
  assert.equal(e.turnCount, 7, "turnCount preserved");
});

test("markSessionEnded returns false for an unknown session", () => {
  const { vault } = freshVault();
  assert.equal(vault.markSessionEnded("nope", "clean-exit"), false);
});

test("ensureDirs creates the project scaffold and seeds meta files", () => {
  const { V, vault } = freshVault();
  const p = vault.ensureDirs("demo");
  assert.ok(fs.existsSync(p.project), "project dir created");
  assert.ok(fs.existsSync(p.sessionMap), "session-map seeded");
  assert.equal(fs.readFileSync(p.sessionMap, "utf8").trim(), "{}", "session-map seeded empty");
  assert.ok(p.project.startsWith(V), "project dir is inside the pinned vault");
});

test("conversation write + frontmatter update round-trips through the vault", () => {
  const { vault } = freshVault();
  const md = require("../lib/markdown.js");
  const p = vault.ensureDirs("demo");
  const file = path.join(p.conversations, "sess__t.md");
  md.writeConversation(file, {
    type: "conversation", session_id: "sess", title: "T", project: "demo",
    tags: ["a", "b"], ended_reason: "in-progress",
  }, "# T\n\nbody");
  // Read back the frontmatter as written.
  let parsed = md.parseFrontmatter(fs.readFileSync(file, "utf8"));
  assert.equal(parsed.meta.session_id, "sess");
  assert.deepEqual(parsed.meta.tags, ["a", "b"]);
  // Update in place and confirm a single frontmatter block with the new value.
  md.updateFrontmatter(file, { ended_reason: "clean-exit" });
  const out = fs.readFileSync(file, "utf8");
  assert.equal(out.match(/^---$/gm).length, 2, "still exactly one frontmatter block");
  parsed = md.parseFrontmatter(out);
  assert.equal(parsed.meta.ended_reason, "clean-exit", "field updated");
  assert.deepEqual(parsed.meta.tags, ["a", "b"], "untouched fields preserved");
  assert.match(parsed.body, /body/, "body preserved");
});
