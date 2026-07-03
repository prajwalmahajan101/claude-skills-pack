// provenance.js — source-anchored claim extraction.
//
// The trust guardrail for distillation: every atomic claim we keep must cite the
// numbered source block it came from, so a distilled note can always be traced
// back to its evidence. Claims that cite nothing are DROPPED (and reported), never
// silently kept — an unsourced claim is exactly the kind of hallucinated fact the
// vault must not harden.
//
// Flow: numberBlocks(sourceText) -> B1..Bn -> (Haiku emits `- claim (src: Bn)`)
// -> splitClaims(lines, validIds) -> { sourced, unsourced }.

// Split a source note body into numbered blocks. A "block" is a paragraph
// (run of non-blank lines) — headings become their own block so they can be
// cited too. Returns [{ id: "B1", text }].
function numberBlocks(body) {
  const paras = String(body || "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/g, "").trim())
    .filter(Boolean);
  return paras.map((text, i) => ({ id: `B${i + 1}`, text }));
}

// Render numbered blocks for a prompt / for verbatim preservation in the note.
function renderNumbered(blocks) {
  return blocks.map((b) => `${b.id}: ${b.text}`).join("\n\n");
}

// Parse the block ids cited in a claim line (e.g. "… (src: B2, B5)").
// Returns { text, sources } where text has the trailing citation stripped.
function parseClaim(line) {
  const raw = String(line || "").replace(/^\s*[-*]\s+/, "").trim();
  const m = raw.match(/\(src:\s*([^)]*)\)\s*$/i);
  if (!m) return { text: raw, sources: [] };
  const sources = m[1].split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^B\d+$/.test(s));
  const text = raw.slice(0, m.index).trim();
  return { text, sources };
}

// Partition claim lines into sourced (cite ≥1 valid block id) and unsourced
// (cite nothing, or only ids not present in the source). validIds is the set of
// block ids from numberBlocks().
function splitClaims(lines, validIds) {
  const valid = new Set(validIds);
  const sourced = [];
  const unsourced = [];
  for (const line of lines) {
    if (!String(line).trim()) continue;
    const c = parseClaim(line);
    if (!c.text) continue;
    const good = c.sources.filter((s) => valid.has(s));
    if (good.length) sourced.push({ text: c.text, sources: good });
    else unsourced.push({ text: c.text, cited: c.sources });
  }
  return { sourced, unsourced };
}

module.exports = { numberBlocks, renderNumbered, parseClaim, splitClaims };
