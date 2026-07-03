#!/usr/bin/env node
// person.js — create or update a people/CRM note (12_People).
// Usage: person.js <name> [--role r] [--company c] [--email e] [--linkedin l]
//                         [--relationship weak|medium|strong] [--log "<interaction>"]

const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { tagFile } = require(path.join(SKILL_LIB, "tagger.js"));
const { ensurePerson, logInteraction } = require(path.join(SKILL_LIB, "people.js"));
const { logActivity } = require(path.join(SKILL_LIB, "remember-bridge.js"));

const opts = parseFlags(process.argv.slice(2));
const name = opts._.join(" ").replace(/^["']|["']$/g, "").trim();
if (!name) { console.error("Usage: person.js <name> [--role] [--company] [--email] [--log <text>]"); process.exit(2); }

const { file, created } = ensurePerson(name, {
  role: opts.role, company: opts.company, email: opts.email,
  linkedin: opts.linkedin, relationship: opts.relationship,
});
if (opts.log) logInteraction(name, opts.log);
tagFile(file);

console.log(`${created ? "Created" : "Updated"} person: ${path.relative(VAULT, file)}`);
if (opts.log) console.log("  + interaction logged.");
logActivity(`person: ${name}${opts.log ? " — " + opts.log : ""}`);

function parseFlags(arr) {
  const out = { _: [] };
  const val = new Set(["role", "company", "email", "linkedin", "relationship", "log"]);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) { const k = a.slice(2); if (val.has(k)) out[k] = arr[++i]; else out[k] = true; }
    else out._.push(a);
  }
  return out;
}
