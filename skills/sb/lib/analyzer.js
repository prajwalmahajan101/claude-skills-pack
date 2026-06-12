// Wraps `claude -p` with a structured JSON-schema prompt over a conversation.
// Phase 8a.1: richer lessons, Sonnet by default, depth env var, code-example schema.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEPTH = process.env.SB_LESSON_DEPTH || "standard"; // brief | standard | deep
const MODEL_BY_DEPTH = {
  brief:    "claude-haiku-4-5-20251001",
  standard: "claude-sonnet-4-6",
  deep:     "claude-sonnet-4-6",
};
const MODEL = process.env.SB_ANALYZER_MODEL || MODEL_BY_DEPTH[DEPTH] || MODEL_BY_DEPTH.standard;
const MAX_TURNS = parseInt(process.env.SB_ANALYZER_MAX_TURNS || "80", 10);
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const SYSTEM_PROMPT_STANDARD = `You are a senior extraction agent building a personal second-brain knowledge base. Read the conversation transcript and return a SINGLE JSON object matching this schema. Output ONLY the JSON — no prose, no markdown fences.

{
  "summary": "2-4 sentence TL;DR of what happened and what was learned",
  "lessons": [
    {
      "title": "Imperative short title (max 80 chars)",
      "context": "1-2 sentences: the situation that produced this insight",
      "insight": "2-4 sentences: the core lesson — WHAT was learned and HOW it works",
      "why_it_matters": "1-2 sentences: consequences of getting this right vs wrong",
      "when_to_apply": "1-2 sentences: signals/situations where this lesson is relevant",
      "pitfalls": "1-2 sentences: common mistakes or edge cases (optional, can be empty string)",
      "related_concepts": ["concept-slug", "..."],
      "code_examples": [{"lang": "bash|js|py|...", "snippet": "≤10 line code or command snippet from the source"}],
      "tags": ["#area/sub", "..."]
    }
  ],
  "takeaways": ["Concise factual statement worth remembering, ≤25 words", "..."],
  "action_items": [
    {"text": "Imperative next step, concrete and assignable", "tags": ["#area"], "due": null}
  ],
  "suggested_tags": ["#area/sub", "..."],
  "suggested_topics": ["topic-slug", "..."]
}

LESSON QUALITY RULES — these are critical:
- Only emit a lesson if it has lasting value (a principle, pattern, gotcha, decision-rationale, or non-obvious discovery). DO NOT emit lessons for one-off bug fixes the code already captures.
- Lessons must be standalone — readable in isolation, no "as we discussed above" references.
- Each section must be substantive. A 5-word "insight" is not acceptable; aim for the depth a senior engineer would write in their personal notes.
- code_examples is OPTIONAL — only include if the conversation contained a specific command/snippet that demonstrates the lesson. Empty array is fine.
- related_concepts are topic slugs (kebab-case, no #) the lesson links to: ["circuit-breaker", "retry-storm"].

TAG RULES:
- Slash-namespaced kebab-case: #area/sub (e.g., #db/postgres, #infra/k8s, #observability/tracing).
- Tag length ≥ 3 chars after #. NO single-letter tags, NO brackets/punctuation.

ACTION ITEM RULES:
- Concrete and verifiable. "Fix the bug" is not an action item; "Add retry-with-backoff to the webhook sender, max 5 attempts" is.

If nothing notable, return empty arrays — do not invent content.`;

const SYSTEM_PROMPT_BRIEF = `You are an extraction agent. Read the conversation and return JSON matching:

{
  "summary": "1-2 sentence TL;DR",
  "lessons": [{"title": "...", "body": "3-5 sentences", "tags": ["#area/sub"]}],
  "takeaways": ["..."],
  "action_items": [{"text": "...", "tags": [], "due": null}],
  "suggested_tags": ["#area/sub"],
  "suggested_topics": ["slug"]
}

Output ONLY the JSON. No fences, no prose. Only include lessons with lasting value.`;

function buildPrompt() {
  return DEPTH === "brief" ? SYSTEM_PROMPT_BRIEF : SYSTEM_PROMPT_STANDARD;
}

function analyzeConversation(convFile) {
  const content = fs.readFileSync(convFile, "utf8");
  // Truncate by turn count if needed
  const turns = content.split(/^## Turn /m);
  let transcript = content;
  if (turns.length - 1 > MAX_TURNS) {
    transcript = turns[0] + turns.slice(1, MAX_TURNS + 1).map((t) => "## Turn " + t).join("");
    transcript += `\n\n[truncated: ${turns.length - 1 - MAX_TURNS} more turns omitted]`;
  }

  const systemPrompt = buildPrompt();
  const prompt = `${systemPrompt}\n\n--- BEGIN TRANSCRIPT ---\n\n${transcript}\n\n--- END TRANSCRIPT ---\n\nReturn ONLY the JSON object.`;
  const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
    input: prompt,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`claude -p failed (model=${MODEL}, depth=${DEPTH}): ${r.stderr || r.status}`);
  }
  const parsed = parseJSON(r.stdout);
  // Normalize: convert structured-body fields back to a `body` string for backward compat,
  // so analyze.js writers can render either schema.
  if (DEPTH !== "brief") {
    for (const lesson of parsed.lessons || []) {
      if (!lesson.body) {
        lesson.body = renderStructuredLesson(lesson);
      }
    }
  }
  return parsed;
}

function renderStructuredLesson(l) {
  const parts = [];
  if (l.context)         parts.push(`## Context\n${l.context}`);
  if (l.insight)         parts.push(`## Insight\n${l.insight}`);
  if (l.why_it_matters)  parts.push(`## Why It Matters\n${l.why_it_matters}`);
  if (l.when_to_apply)   parts.push(`## When To Apply\n${l.when_to_apply}`);
  if (l.pitfalls)        parts.push(`## Pitfalls\n${l.pitfalls}`);
  if ((l.code_examples || []).length) {
    const codes = l.code_examples.map(c => "```" + (c.lang || "") + "\n" + c.snippet + "\n```").join("\n\n");
    parts.push(`## Examples\n${codes}`);
  }
  if ((l.related_concepts || []).length) {
    const links = l.related_concepts.map(c => `[[${c}]]`).join(" · ");
    parts.push(`## Related\n${links}`);
  }
  return parts.join("\n\n");
}

function parseJSON(text) {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(json)?\n/, "").replace(/\n```\s*$/, "");
  }
  try { return JSON.parse(t); }
  catch (e) {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Cannot parse analyzer output: ${e.message}\nOutput: ${t.slice(0, 500)}`);
  }
}

module.exports = { analyzeConversation, MODEL, DEPTH };
