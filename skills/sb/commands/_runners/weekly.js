#!/usr/bin/env node
// /sb:weekly — 7-day rollup synthesized via claude -p, written to reviews/<YYYY-WNN>.md.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT, paths, readSessionMap, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const P = paths("_");
const { parseFrontmatter, fm } = require(path.join(SKILL_LIB, "markdown.js"));

const MODEL = process.env.SB_WEEKLY_MODEL || "claude-sonnet-4-6";
const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";

const now = new Date();
const cutoff = now.getTime() - 7 * 86400000;
const iso = now.toISOString().slice(0, 10);
const year = now.getUTCFullYear();
const week = String(getISOWeek(now)).padStart(2, "0");
const reviewFile = path.join(P.reviewsWeekly, `${year}-W${week}.md`);

// Gather: lessons (last 7d), tasks done (last 7d), tags by frequency, projects touched
const map = readSessionMap();
const recentLessons = [];
const lessonsDir = P.lessons;
if (fs.existsSync(lessonsDir)) {
  for (const f of fs.readdirSync(lessonsDir)) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(lessonsDir, f);
    try {
      const st = fs.statSync(full);
      if (st.mtimeMs < cutoff) continue;
      const { meta, body } = parseFrontmatter(fs.readFileSync(full, "utf8"));
      recentLessons.push({ file: f, body, tags: meta.tags || [], project: meta.source_project });
    } catch {}
  }
}

const tagCounts = {};
const projectCounts = {};
for (const l of recentLessons) {
  if (l.project) projectCounts[l.project] = (projectCounts[l.project] || 0) + 1;
  for (const t of l.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
}

const tasksDone = [];
const tasksRoot = path.join(VAULT, DIR.projects);
if (fs.existsSync(tasksRoot)) {
  walk(tasksRoot, (f) => {
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(f, "utf8"));
      if (meta.completed_at && new Date(meta.completed_at).getTime() >= cutoff) {
        tasksDone.push({ file: path.relative(VAULT, f), title: meta.title || f, project: meta.project });
      }
    } catch {}
  });
}

const summary = {
  week: `${year}-W${week}`,
  cutoffISO: new Date(cutoff).toISOString(),
  endISO: now.toISOString(),
  lessons_count: recentLessons.length,
  tasks_done_count: tasksDone.length,
  projects_active: Object.keys(projectCounts),
  top_tags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15),
};

console.log(`Weekly review for ${summary.week} — ${recentLessons.length} lessons, ${tasksDone.length} tasks done.`);

if (recentLessons.length === 0 && tasksDone.length === 0) {
  console.log("(empty week — nothing to synthesize)");
  process.exit(0);
}

console.log(`Asking ${MODEL} for synthesis…`);

const lessonsForLLM = recentLessons.map(l => `### ${l.file}\n${l.body.slice(0, 1500)}`).join("\n\n---\n\n");
const prompt = `You are writing a weekly review for a software engineer's second brain. Synthesize the past week's lessons and completed tasks into a coherent narrative.

OUTPUT FORMAT — return ONLY markdown, no fences:

## Themes
2-4 bullet themes that emerged this week. Each theme cites 1-3 lessons by their wikilink.

## Top Learnings
Top 3 most impactful lessons synthesized in your own words (not just quoted). Cite source lessons.

## Action Items Still Open
Any pending follow-ups you'd recommend.

## Patterns
1-2 cross-project patterns or recurring concerns you notice.

DATA:
- Period: ${summary.cutoffISO} → ${summary.endISO}
- Projects touched: ${summary.projects_active.join(", ") || "(none)"}
- Top tags: ${summary.top_tags.map(([t, n]) => `${t}(${n})`).join(", ")}
- Tasks completed: ${tasksDone.map(t => `[[${path.basename(t.file, ".md")}]]`).join(", ") || "(none)"}

LESSONS:

${lessonsForLLM || "(no lessons this week)"}`;

const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
  input: prompt, encoding: "utf8", maxBuffer: 100 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error(`claude -p failed: ${r.stderr || r.status}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(reviewFile), { recursive: true });
const front = {
  type: "weekly-review",
  week: summary.week,
  period_start: summary.cutoffISO,
  period_end: summary.endISO,
  lessons_count: summary.lessons_count,
  tasks_done_count: summary.tasks_done_count,
  projects: summary.projects_active,
  tags: summary.top_tags.map(([t]) => t),
};
const body = `# Weekly Review — ${summary.week}\n\n${r.stdout.trim()}\n`;
fs.writeFileSync(reviewFile, fm(front) + body);
console.log(`Wrote: ${path.relative(VAULT, reviewFile)}`);

function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn);
    else if (e.isFile() && e.name.endsWith(".md")) fn(full);
  }
}
