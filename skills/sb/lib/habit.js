// habit.js — habit-tracker notes (15_Habits). Each habit is one note with a
// markdown log table (date | done) and computed current/longest streak.

const fs = require("node:fs");
const path = require("node:path");

const { VAULT, DIR, slugify } = require("./vault.js");
const { fm, parseFrontmatter } = require("./markdown.js");
const { preambleBlock } = require("./ai-first.js");

function habitsDir() {
  const d = path.join(VAULT, DIR.habits);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function habitFile(name) {
  return path.join(habitsDir(), `${slugify(name)}.md`);
}

function ensureHabit(name, cadence = "daily") {
  const file = habitFile(name);
  if (!fs.existsSync(file)) {
    const front = fm({
      type: "habit",
      name,
      cadence,
      created: new Date().toISOString().slice(0, 10),
      streak: 0,
      longest: 0,
      tags: ["habit"],
      "ai-first": true,
    });
    const body = preambleBlock(`Habit tracker for "${name}" (${cadence}). The Log table records each completion; streak/longest live in frontmatter.`) +
      `\n# ${name}\n\n## Log\n| date | done |\n| --- | --- |\n`;
    fs.writeFileSync(file, front + body);
  }
  return file;
}

// Read the set of completed dates from the log table.
function logDates(file) {
  const text = fs.readFileSync(file, "utf8");
  const dates = [];
  for (const m of text.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(?:x|✓|done|yes)\s*\|/gim)) {
    dates.push(m[1]);
  }
  return [...new Set(dates)].sort();
}

// Mark a habit done for a date (default today). Recomputes streaks. Returns
// { streak, longest, already }.
function markDone(name, date = new Date().toISOString().slice(0, 10)) {
  const file = ensureHabit(name);
  let text = fs.readFileSync(file, "utf8");
  const already = new RegExp(`^\\|\\s*${date}\\s*\\|`, "m").test(text);
  if (!already) {
    // Append a row at the end of the Log table.
    text = text.replace(/\s*$/, "") + `\n| ${date} | x |\n`;
    fs.writeFileSync(file, text);
  }
  const { streak, longest } = computeStreaks(logDates(file));
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, fm({ ...meta, streak, longest }) + body);
  return { streak, longest, already };
}

// current streak (counting back from today) + longest run of consecutive days.
function computeStreaks(dates) {
  if (!dates.length) return { streak: 0, longest: 0 };
  const set = new Set(dates);
  // current streak from today backwards
  let streak = 0;
  let d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  // longest consecutive run
  let longest = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]); prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().slice(0, 10) === dates[i]) { run++; longest = Math.max(longest, run); }
    else run = 1;
  }
  return { streak, longest };
}

// List all habits with today's status + current streak.
function listHabits() {
  const dir = habitsDir();
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const file = path.join(dir, f);
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(file, "utf8"));
      const dates = logDates(file);
      const { streak, longest } = computeStreaks(dates);
      out.push({ name: meta.name || path.basename(f, ".md"), cadence: meta.cadence || "daily", streak, longest, doneToday: dates.includes(today) });
    } catch {}
  }
  return out;
}

module.exports = { habitsDir, habitFile, ensureHabit, markDone, listHabits, computeStreaks };
