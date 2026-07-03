// ai-first.js — the "AI-first vault" rule for sb notes.
//
// Notes are written for FUTURE-CLAUDE to read and reason over, not for human
// review. Every first-class note (lesson, topic, project, memory) should carry:
//   1. a `## For future Claude` preamble (2-3 sentence machine summary), and
//   2. rich frontmatter including `ai-first: true` (+ `type`, `tags`, a date).
//
// This module is the single source of truth, shared by the note-writing runners
// (lesson.js, topic.js, memory-bridge.js) and the write-time validator hook
// (~/.claude/hooks/sb-validate.js). Adapted from obsidian-second-brain's
// references/ai-first-rules.md + hooks/validate-ai-first.sh, ported to JS.

const PREAMBLE_HEADER = "## For future Claude";

// Build the preamble block that leads a note body.
// summary: a 2-3 sentence plain-English description of what the note is and why
// it was saved. Falls back to a minimal stub so the header is always present.
function preambleBlock(summary) {
  const s = String(summary || "").trim() ||
    "This note was captured by sb. See the content below for details.";
  return `${PREAMBLE_HEADER}\n${s}\n`;
}

// Merge the AI-first frontmatter flag (and optional confidence) into a
// frontmatter object WITHOUT clobbering existing type/tags/date fields.
// base: an object destined for lib/markdown.js `fm()`.
// opts.confidence: one of stated | high | medium | speculation (optional).
function aiFirstFront(base = {}, opts = {}) {
  const out = { ...base, "ai-first": true };
  if (opts.confidence) out.confidence = opts.confidence;
  return out;
}

// True if `body` already opens with (or contains near the top) the preamble.
function hasPreamble(body) {
  return new RegExp(`^${escapeRe(PREAMBLE_HEADER)}\\b`, "m").test(String(body || ""));
}

// Ensure a rendered note body starts with the preamble. If a summary is given
// and no preamble exists, prepend one; otherwise return the body unchanged.
function withPreamble(body, summary) {
  const b = String(body || "");
  if (hasPreamble(b)) return b;
  return `${preambleBlock(summary)}\n${b}`;
}

// Banned non-ASCII substitution characters (smart quotes / dashes) → ASCII hint.
// Explicit ban list; anything not listed passes. Mirrors validate-ai-first.sh.
const BANNED = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "…": "...", " ": " ",
};

// Validate a note's raw markdown content against the AI-first rule.
// Returns { ok, warnings[] } — warnings are advisory (non-blocking).
function validateNote(content) {
  const warnings = [];
  const text = String(content || "");

  // 1. Frontmatter delimiters well-formed.
  if (!text.startsWith("---\n")) {
    warnings.push("no frontmatter (expected `---` on line 1); AI-first notes need date/type/tags/ai-first.");
    // Without frontmatter the remaining structural checks are meaningless.
    return { ok: false, warnings };
  }
  const fmEnd = text.indexOf("\n---", 4);
  if (fmEnd === -1) {
    warnings.push("frontmatter is missing its closing `---` delimiter.");
  }
  const front = fmEnd === -1 ? "" : text.slice(4, fmEnd);

  // 2. No tabs inside frontmatter (YAML requires spaces).
  if (/\t/.test(front)) warnings.push("frontmatter contains tab characters; YAML requires spaces.");

  // 3. Required AI-first fields.
  for (const field of ["type", "tags"]) {
    if (!new RegExp(`^${field}:`, "m").test(front)) {
      warnings.push(`frontmatter missing \`${field}\`.`);
    }
  }
  if (!/^ai-first:\s*true/m.test(front)) {
    warnings.push("frontmatter missing `ai-first: true`.");
  }
  if (!/^(date|created):/m.test(front)) {
    warnings.push("frontmatter missing a `date` (or `created`) field.");
  }

  // 4. `## For future Claude` preamble present.
  if (!hasPreamble(text)) {
    warnings.push('missing the `## For future Claude` preamble.');
  }

  // 5. Banned substitution characters (report first few, with codepoints).
  const bad = [];
  for (const ch of text) {
    if (BANNED[ch] && !bad.some((b) => b.ch === ch)) {
      bad.push({ ch, hint: BANNED[ch], cp: "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0") });
    }
  }
  for (const b of bad.slice(0, 4)) {
    warnings.push(`non-ASCII char ${b.cp} — use "${b.hint}" instead.`);
  }

  return { ok: warnings.length === 0, warnings };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ---- Verified / unverified (AI-drafted) support ----------------------------
// The forum's strongest guardrail: never let unverified AI drafts silently
// harden into fact. Generative paths (Haiku-drafted lessons/decisions/zettels)
// mark the note `verified: false` and prepend a visible callout; /sb:verify flips
// it after a human reviews.

const AI_CALLOUT_RE = /^> \[!ai\][^\n]*\n(?:>[^\n]*\n?)*\n?/m;

// A visible Obsidian callout warning the note is an unverified AI draft.
function aiCallout(model) {
  const m = model || "an AI model";
  return `> [!ai] Drafted by ${m} — unverified.\n> Challenge before trusting; run /sb:verify once reviewed.\n`;
}

// Frontmatter for an AI-drafted (unverified) note.
function unverifiedFront(base = {}, model = "") {
  return { ...aiFirstFront(base), verified: false, drafted_by: model || "unknown" };
}

// Remove the [!ai] callout block from a body (used by /sb:verify).
function stripAiCallout(body) {
  return String(body || "").replace(AI_CALLOUT_RE, "");
}

// Merge verification stamps into a frontmatter object (used by /sb:verify).
function markVerified(front = {}, by = "human") {
  return { ...front, verified: true, verified_by: by, verified_at: new Date().toISOString().slice(0, 10) };
}

module.exports = {
  PREAMBLE_HEADER,
  preambleBlock, aiFirstFront, hasPreamble, withPreamble, validateNote,
  aiCallout, unverifiedFront, stripAiCallout, markVerified,
};
