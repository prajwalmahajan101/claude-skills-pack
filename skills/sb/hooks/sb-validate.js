#!/usr/bin/env node
// sb-validate: PostToolUse (Write|Edit) hook — enforce the AI-first vault rule.
//
// Non-blocking: inspects the just-written file; if it is a first-class sb note
// (lesson / topic / project note / memory mirror) inside the vault that misses
// the AI-first structure (frontmatter, `## For future Claude` preamble, ASCII),
// it prints a warning to stderr. The write ALWAYS succeeds (exit 0) — this nudges
// future-Claude to repair, it never reverts a write.
//
// Disabled by SB_DISABLE=1 or SB_VALIDATE_DISABLE=1.

if (process.env.SB_DISABLE === "1" || process.env.SB_VALIDATE_DISABLE === "1") process.exit(0);

const fs = require("node:fs");
const path = require("node:path");

try { main(); } catch { /* never block */ }
process.exit(0);

function main() {
  const input = readStdinSync();
  const hook = safeJSON(input);
  const file = hook?.tool_input?.file_path || hook?.args?.file_path || "";
  if (!file || !file.endsWith(".md") || !fs.existsSync(file)) return;

  const SKILL_LIB = path.join(__dirname, "..", "lib");
  let VAULT, validateNote;
  try {
    ({ VAULT } = require(path.join(SKILL_LIB, "vault.js")));
    ({ validateNote } = require(path.join(SKILL_LIB, "ai-first.js")));
  } catch { return; }

  // Only validate first-class notes inside the vault.
  const rel = path.relative(VAULT, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return; // outside vault
  const top = rel.split(path.sep)[0];
  const CHECK = new Set(["03_Lessons", "04_Topics", "02_Projects", "08_Insights", "10_Memory",
    "11_Decisions", "12_People", "13_Meetings", "14_Zettelkasten", "15_Habits", "16_Ideas"]);
  if (!CHECK.has(top)) return; // conversations/inbox/exports/templates are exempt
  // Within 02_Projects, only validate hand-authored notes (tasks, decisions).
  // Skip scaffolding/plans and the journal/ + reviews/ mirrors (auto-generated
  // copies of external repo prose — their typography is not ours to enforce).
  if (top === "02_Projects" && /(\/plans\/|\/journal\/|\/reviews\/|INDEX\.md$|kanban\.md$|lessons\.md$)/.test(rel)) return;

  let content = "";
  try { content = fs.readFileSync(file, "utf8"); } catch { return; }
  const { ok, warnings } = validateNote(content);
  if (ok) return;

  process.stderr.write(
    `sb ai-first warning — ${path.basename(file)}:\n` +
    warnings.map((w) => `  - ${w}`).join("\n") +
    `\n  (non-blocking; see lib/ai-first.js. The write was NOT reverted.)\n`
  );
}

function readStdinSync() {
  try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
}
function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }
