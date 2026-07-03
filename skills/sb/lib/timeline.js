// timeline.js — bi-temporal facts for vault notes.
//
// A note's frontmatter carries the CURRENT value of a field (e.g. `role: CTO`).
// When that value changes we never silently overwrite it — we append a compact
// history entry to a `timeline:` array and only then update the top-level field.
// Each entry is a single pipe-delimited string so it survives lib/markdown.js's
// simple YAML writer without needing nested structures:
//
//   timeline:
//     - role|Engineer|2023-01-10|manual
//     - role|CTO|2025-06-01|meeting-notes
//   role: CTO
//
// field  = the frontmatter field the value belongs to
// value  = the value that became true
// from   = ISO date (YYYY-MM-DD) the value became effective (valid-time)
// source = where the change was learned (free text: manual, meeting, council…)
//
// Reusable by lib/people.js (role/company/relationship) and project INDEX status.

const fs = require("node:fs");
const { parseFrontmatter, fm } = require("./markdown.js");

const SEP = "|";

// Replace the separator (and newlines) so a component round-trips cleanly.
function clean(s) {
  return String(s == null ? "" : s).replace(/[|\n\r]+/g, "/").trim();
}

function encodeEntry({ field, value, from, source }) {
  return [clean(field), clean(value), clean(from), clean(source)].join(SEP);
}

function decodeEntry(str) {
  const [field, value, from, source] = String(str).split(SEP);
  return { field: field || "", value: value || "", from: from || "", source: source || "" };
}

// Coerce a frontmatter timeline value (array | single string | undefined) → string[].
function coerceTimeline(t) {
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === "string" && t.trim()) return [t];
  return [];
}

// Full ordered history of `field` (oldest → newest, in append order).
function historyOf(file, field) {
  if (!fs.existsSync(file)) return [];
  const { meta } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  return coerceTimeline(meta.timeline)
    .map(decodeEntry)
    .filter((e) => e.field === field);
}

// The current (latest-recorded) value of `field` — from the timeline if present,
// else the plain top-level frontmatter field.
function currentValue(file, field) {
  const hist = historyOf(file, field);
  if (hist.length) return hist[hist.length - 1].value;
  if (!fs.existsSync(file)) return undefined;
  const { meta } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  return meta[field];
}

// Record a (possibly) new value for `field`. Never overwrites history: if the
// value differs from the current one it appends a timeline entry AND updates the
// top-level field; if it is unchanged it is a no-op. Returns
// { changed, from, to } so callers can report.
//
// opts: { field, value, from?=today, source?="manual" }
function appendTimeline(file, opts) {
  const field = opts.field;
  const value = String(opts.value == null ? "" : opts.value).trim();
  const from = opts.from || new Date().toISOString().slice(0, 10);
  const source = opts.source || "manual";

  if (!fs.existsSync(file)) return { changed: false, from: undefined, to: value };
  const raw = fs.readFileSync(file, "utf8");
  const { meta, body } = parseFrontmatter(raw);

  const prev = currentValue(file, field);
  const prevStr = String(prev == null ? "" : prev).trim();
  if (prevStr === value) {
    return { changed: false, from: prev, to: value };
  }

  const timeline = coerceTimeline(meta.timeline);
  // On the FIRST recorded change, seed the prior top-level value so no history is
  // lost (the original value predates the timeline; mark its source `initial`).
  const existingForField = timeline.map(decodeEntry).some((e) => e.field === field);
  if (!existingForField && prevStr) {
    timeline.push(encodeEntry({
      field, value: prevStr,
      from: meta.date || meta.created || "unknown",
      source: "initial",
    }));
  }
  timeline.push(encodeEntry({ field, value, from, source }));
  const merged = { ...meta, timeline, [field]: value };
  fs.writeFileSync(file, fm(merged) + body);
  return { changed: true, from: prev, to: value };
}

module.exports = {
  appendTimeline, currentValue, historyOf,
  encodeEntry, decodeEntry, coerceTimeline,
};
