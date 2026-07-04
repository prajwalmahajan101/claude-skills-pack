"use strict";
// Tests for frontmatter parsing/round-trip and the memory-fact bridge. Zero-dep:
// node:test + node:assert. Guards two integrity bugs: nested `metadata:` maps were
// dropped on parse (corrupting every promoted fact), and updateFrontmatter stacked
// a second block onto notes with unterminated frontmatter.
// Run: node --test  (from skills/sb/)

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const md = require("../lib/markdown.js");

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "sb-md-")); }

test("parseFrontmatter reads a one-level nested map", () => {
  const { meta } = md.parseFrontmatter(
    "---\nname: x\ndescription: hi\nmetadata:\n  type: decision\n  originSessionId: abc123\n---\nbody\n"
  );
  assert.deepEqual(meta.metadata, { type: "decision", originSessionId: "abc123" });
  assert.equal(meta.description, "hi");
});

test("parseFrontmatter still reads lists and scalars (back-compat)", () => {
  const { meta } = md.parseFrontmatter("---\ntags:\n  - a\n  - b\ntype: note\nai-first: true\nx: null\n---\nz");
  assert.deepEqual(meta.tags, ["a", "b"]);
  assert.equal(meta.type, "note", "a non-indented key correctly ends the list");
  assert.equal(meta["ai-first"], true);
  assert.equal(meta.x, null);
});

test("promoteFact -> listFacts round-trips type and session (H2 regression)", () => {
  const dir = tmp();
  const prev = process.env.SB_MEMORY_DIR;
  process.env.SB_MEMORY_DIR = dir;
  try {
    // require after env is set so memoryDir() resolves to the temp dir.
    delete require.cache[require.resolve("../lib/memory-bridge.js")];
    const mb = require("../lib/memory-bridge.js");
    mb.promoteFact({ name: "prefer-rebase", description: "rebase over merge", type: "feedback", body: "why", session: "sess-42" });
    const facts = mb.listFacts();
    const f = facts.find((x) => x.slug === "prefer-rebase");
    assert.ok(f, "fact listed");
    assert.equal(f.type, "feedback", "nested metadata.type recovered (was 'reference')");
    assert.equal(f.session, "sess-42", "nested originSessionId recovered (was null)");
  } finally {
    if (prev === undefined) delete process.env.SB_MEMORY_DIR;
    else process.env.SB_MEMORY_DIR = prev;
    delete require.cache[require.resolve("../lib/memory-bridge.js")];
  }
});

test("updateFrontmatter updates a valid note in place (single block)", () => {
  const dir = tmp();
  const file = path.join(dir, "note.md");
  fs.writeFileSync(file, "---\ntype: note\nstatus: active\n---\nbody text\n");
  md.updateFrontmatter(file, { status: "ended" });
  const out = fs.readFileSync(file, "utf8");
  assert.equal(out.match(/^---$/gm).length, 2, "exactly one frontmatter block");
  assert.match(out, /status: ended/);
  assert.match(out, /body text/);
});

test("updateFrontmatter refuses to stack a block on unterminated frontmatter (H4 regression)", () => {
  const dir = tmp();
  const file = path.join(dir, "broken.md");
  const original = "---\ntype: note\nstatus: active\nbody with no closing delimiter\n";
  fs.writeFileSync(file, original);
  md.updateFrontmatter(file, { status: "ended" });
  const out = fs.readFileSync(file, "utf8");
  assert.equal(out, original, "malformed note left untouched, not double-blocked");
});
