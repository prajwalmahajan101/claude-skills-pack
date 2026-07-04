"use strict";
// Tests for the JSONL capture/resume path. Zero-dep: node:test + node:assert.
// Guards the data-loss bug where readEvents advanced the byte offset past an
// unterminated trailing line, permanently dropping the completed record on resume.
// Run: node --test  (from skills/sb/)

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { readEvents } = require("../lib/jsonl.js");

function tmpFile() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sb-jsonl-"));
  return path.join(d, "session.jsonl");
}
const rec = (o) => JSON.stringify(o);

test("resume across a mid-line flush drops no record and duplicates none", () => {
  const f = tmpFile();
  // First write: one complete record + a PARTIAL second record (no trailing newline).
  const line1 = rec({ type: "user", n: 1 }) + "\n";
  const line2 = rec({ type: "assistant", n: 2 }) + "\n";
  fs.writeFileSync(f, line1 + line2.slice(0, 10)); // line2 truncated mid-record
  const r1 = readEvents(f, 0);
  assert.deepEqual(r1.events.map((e) => e.n), [1], "only the complete record is consumed");
  assert.equal(r1.size, line1.length, "offset stops at the last newline, not stat.size");

  // Writer completes line2 and adds line3.
  const line3 = rec({ type: "user", n: 3 }) + "\n";
  fs.appendFileSync(f, line2.slice(10) + line3);
  const r2 = readEvents(f, r1.size);
  assert.deepEqual(r2.events.map((e) => e.n), [2, 3], "the previously-partial record is recovered whole");
});

test("a multibyte codepoint split across the read boundary is recovered intact", () => {
  const f = tmpFile();
  const line1 = rec({ type: "user", text: "hi" }) + "\n";
  const line2 = rec({ type: "assistant", text: "😀 grin" }) + "\n";
  const full = Buffer.from(line1 + line2, "utf8");
  // Cut inside the 4-byte 😀 of line2 (no newline in the partial tail).
  const emojiByte = Buffer.from(line1, "utf8").length + line2.indexOf("😀") + 2;
  fs.writeFileSync(f, full.slice(0, emojiByte));
  const r1 = readEvents(f, 0);
  assert.deepEqual(r1.events.map((e) => e.text), ["hi"], "partial multibyte line not consumed");
  // Complete the file.
  fs.writeFileSync(f, full);
  const r2 = readEvents(f, r1.size);
  assert.equal(r2.events[0].text, "😀 grin", "emoji record recovered without corruption");
});

test("no newline in the window consumes nothing", () => {
  const f = tmpFile();
  fs.writeFileSync(f, rec({ type: "user", n: 1 })); // no trailing newline at all
  const r = readEvents(f, 0);
  assert.deepEqual(r.events, []);
  assert.equal(r.size, 0, "offset unchanged so the record is re-read once completed");
});

test("malformed complete lines are skipped, not fatal", () => {
  const f = tmpFile();
  fs.writeFileSync(f, "not json\n" + rec({ type: "user", n: 7 }) + "\n");
  const r = readEvents(f, 0);
  assert.deepEqual(r.events.map((e) => e.n), [7]);
});
