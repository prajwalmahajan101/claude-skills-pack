#!/usr/bin/env node
// meeting.js — create a meeting note (13_Meetings) with auto-linked attendees.
// Usage: meeting.js "<title>" [--attendees a,b,c] [--at "YYYY-MM-DD HH:mm"] [--mins N]
//
// Each attendee gets a 12_People stub (if missing) + an interaction-log entry.
// Links to today's daily note. Structured Agenda / Notes / Decisions / Action Items.

const fs = require("node:fs");
const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, DIR, paths, ensureDirs, slugify } = require(path.join(SKILL_LIB, "vault.js"));
const { fm } = require(path.join(SKILL_LIB, "markdown.js"));
const { preambleBlock, aiFirstFront } = require(path.join(SKILL_LIB, "ai-first.js"));
const { tagFile } = require(path.join(SKILL_LIB, "tagger.js"));
const { ensurePerson, logInteraction, personLink } = require(path.join(SKILL_LIB, "people.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const opts = parseFlags(process.argv.slice(2));
const title = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
if (!title) { console.error('Usage: meeting.js "<title>" [--attendees a,b] [--at "..."]'); process.exit(2); }

ensureDirs("_");
const P = paths("_");
fs.mkdirSync(P.meetings, { recursive: true });

const start = opts.at ? new Date(opts.at.replace(" ", "T")) : new Date();
const date = iso(start).slice(0, 10);
const mins = parseInt(opts.mins || "60", 10);
const end = new Date(start.getTime() + mins * 60000);

const attendees = (opts.attendees || "").split(",").map((s) => s.trim()).filter(Boolean);
for (const a of attendees) { ensurePerson(a); logInteraction(a, `Meeting: ${title}`); }

const file = path.join(P.meetings, `${date}-${slugify(title)}.md`);
const front = aiFirstFront({
  type: "meeting",
  title,
  date,
  starts_on: `${date} ${hhmm(start)}`,
  ends_on: `${iso(end).slice(0, 10)} ${hhmm(end)}`,
  attendees: attendees.map((a) => personLink(a)),
  tags: ["meeting"],
});
const body =
  preambleBlock(`Meeting "${title}" on ${date}. Attendees, agenda, decisions, and action items; each attendee is linked to their People note.`) +
  `\n# Meeting — ${title} (${date} ${hhmm(start)}–${hhmm(end)})\n\n` +
  `**Attendees:** ${attendees.map((a) => personLink(a)).join(", ") || "TBD"}\n` +
  `**Daily note:** [[${DIR.reviews}/Daily/${date}]]\n\n` +
  `## Agenda\n\n\n## Notes\n\n\n## Decisions\n\n\n## Action Items\n- [ ] \n`;

fs.writeFileSync(file, fm(front) + body);
tagFile(file);
console.log(`Wrote meeting: ${path.relative(VAULT, file)}`);
if (attendees.length) console.log(`  Linked ${attendees.length} attendee(s); interaction logged.`);
logActivity(`meeting: ${title} (${attendees.length} attendee(s))`);

function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString(); }
function hhmm(d) { return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

function parseFlags(arr) {
  const out = { _: [] };
  const val = new Set(["attendees", "at", "mins"]);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) { const k = a.slice(2); if (val.has(k)) out[k] = arr[++i]; else out[k] = true; }
    else out._.push(a);
  }
  return out;
}
