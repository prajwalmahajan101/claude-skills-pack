#!/usr/bin/env node
// dashboard.js — regenerate the Life-Dashboard homepage (00_Dashboard/Home.md +
// Today.md), and point the `homepage` plugin at Home.md.
//
// Uses the ai-mind vault's installed plugins: embedded Bases (review queue, tasks,
// decisions), Dataview (recent lessons/zettels), a Tasks block, plus statically
// rendered Habits + Memory/Remember highlights from the bridges.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, DIR, paths } = require(path.join(SKILL_LIB, "vault.js"));
const { listFacts } = require(path.join(SKILL_LIB, "memory-bridge.js"));
const { recentHighlights } = require(path.join(SKILL_LIB, "remember-bridge.js"));
const { listHabits } = require(path.join(SKILL_LIB, "habit.js"));

const P = paths("_");
fs.mkdirSync(P.dashboard, { recursive: true });
const D = DIR.dashboard;
const date = new Date().toISOString().slice(0, 10);

const habits = safe(() => listHabits(), []);
const facts = safe(() => listFacts().slice(0, 6), []);
const highlights = safe(() => recentHighlights(4), []);

const home = `---
type: dashboard
updated: ${date}
tags: [dashboard]
---

# Life Dashboard

> [!warning]+ Unverified — needs review
> \`\`\`base
> ![[${D}/unverified.base]]
> \`\`\`

## Tasks
![[${D}/tasks.base]]

> [!todo]+ Due today (inline tasks)
> \`\`\`tasks
> not done
> due on ${date}
> sort by priority
> \`\`\`

## Recent lessons (7d)
\`\`\`dataview
TABLE date, tags FROM "${DIR.lessons}"
WHERE date >= date(today) - dur(7 days)
SORT date DESC
LIMIT 10
\`\`\`

## Recent zettels
\`\`\`dataview
LIST FROM "${DIR.zettel}"
SORT file.ctime DESC
LIMIT 8
\`\`\`

## Open review issues + decisions
![[${D}/reviews.base]]
![[${D}/decisions.base]]

## Habits
${renderHabits(habits)}

## Memory
${facts.length ? facts.map((f) => `- **${f.slug}** — ${f.description}`).join("\n") : "_(none)_"}

## Recently (from ~/.remember)
${highlights.length ? highlights.map((h) => `- ${h.slice(0, 120)}`).join("\n") : "_(none)_"}

## People & Meetings
![[${D}/people.base]]
![[${D}/meetings.base]]

## Knowledge graph
See \`${DIR.exports}/graph/\` (run \`/sb:graph\`).
`;

fs.writeFileSync(path.join(P.dashboard, "Home.md"), home);

const today = `---
type: daily
date: ${date}
tags: [daily]
---

# ${date}

> [!warning]+ Overdue
> \`\`\`tasks
> not done
> due before ${date}
> sort by due date
> \`\`\`

> [!todo]+ Due today
> \`\`\`tasks
> not done
> due on ${date}
> \`\`\`

## Notes


## Meetings today
\`\`\`dataview
LIST FROM "${DIR.meetings}" WHERE date = date("${date}")
\`\`\`

## Habits
${renderHabits(habits)}
`;

fs.writeFileSync(path.join(P.dashboard, "Today.md"), today);
pointHomepage();

console.log(`Regenerated ${D}/Home.md and ${D}/Today.md.`);

// ---------------------------------------------------------------------------

function renderHabits(hs) {
  if (!hs.length) return "_No habits yet — /sb:habit \"<name>\" --done_";
  return ["| habit | today | streak | longest |", "| --- | --- | --- | --- |",
    ...hs.map((h) => `| ${h.name} | ${h.doneToday ? "✅" : "⬜"} | ${h.streak} | ${h.longest} |`)].join("\n");
}

// Point the Obsidian `homepage` community plugin at Home.md (best-effort).
function pointHomepage() {
  const cfg = path.join(VAULT, ".obsidian", "plugins", "homepage", "data.json");
  try {
    if (!fs.existsSync(cfg)) return;
    const data = JSON.parse(fs.readFileSync(cfg, "utf8"));
    data.homepages = data.homepages || {};
    // homepage plugin stores a map of homepage configs; set the default.
    const target = `${D}/Home`;
    if (data.homepages.Default) data.homepages.Default.value = target;
    else data.homepages.Default = { value: target, kind: "File", openOnStartup: true, openMode: "Replace" };
    fs.writeFileSync(cfg, JSON.stringify(data, null, 2));
  } catch {}
}

function safe(fn, fb) { try { return fn(); } catch { return fb; } }
