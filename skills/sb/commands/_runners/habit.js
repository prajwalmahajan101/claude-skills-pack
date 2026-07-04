#!/usr/bin/env node
// habit.js — habit tracker.
// Usage:
//   habit.js --list                       list all habits + today's status + streak
//   habit.js "<name>" [--done] [--cadence daily]   create/log a habit

const path = require("node:path");

const SKILL_LIB = path.join(__dirname, "..", "..", "lib");
const { VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { tagFile } = require(path.join(SKILL_LIB, "tagger.js"));
const { ensureHabit, markDone, listHabits } = require(path.join(SKILL_LIB, "habit.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const opts = parseFlags(process.argv.slice(2));

if (opts.list || opts._.length === 0) {
  const habits = listHabits();
  if (!habits.length) { console.log("No habits yet. Create one: habit.js \"<name>\" --done"); process.exit(0); }
  console.log("Habits:");
  for (const h of habits) {
    const mark = h.doneToday ? "[x]" : "[ ]";
    console.log(`  ${mark} ${h.name}  — streak ${h.streak} (longest ${h.longest}), ${h.cadence}`);
  }
  process.exit(0);
}

const name = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
const file = ensureHabit(name, opts.cadence || "daily");
tagFile(file);

if (opts.done) {
  const { streak, longest, already } = markDone(name);
  console.log(`${already ? "Already logged today" : "Logged"} "${name}" — streak ${streak} (longest ${longest}).`);
  logActivity(`habit: ${name} done (streak ${streak})`);
} else {
  console.log(`Habit ready: ${path.relative(VAULT, file)}. Log it with --done.`);
}

function parseFlags(arr) {
  const out = { _: [] };
  const val = new Set(["cadence"]);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) { const k = a.slice(2); if (val.has(k)) out[k] = arr[++i]; else out[k] = true; }
    else out._.push(a);
  }
  return out;
}
