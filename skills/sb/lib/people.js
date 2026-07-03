// people.js — people / CRM notes (12_People). Shared by /sb:person and /sb:meeting
// (meetings auto-create attendee stubs and append interaction-log entries).

const fs = require("node:fs");
const path = require("node:path");

const { VAULT, DIR, slugify } = require("./vault.js");
const { fm, parseFrontmatter, updateFrontmatter } = require("./markdown.js");
const { preambleBlock } = require("./ai-first.js");

function peopleDir() {
  const d = path.join(VAULT, DIR.people);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function personFile(name) {
  return path.join(peopleDir(), `${slugify(name)}.md`);
}

// Ensure a person note exists (creating a stub if missing). Returns { file, slug, created }.
function ensurePerson(name, fields = {}) {
  const slug = slugify(name);
  const file = personFile(name);
  const created = !fs.existsSync(file);
  if (created) {
    const front = fm({
      type: "person",
      name,
      date: new Date().toISOString().slice(0, 10),
      role: fields.role || "",
      company: fields.company || "",
      email: fields.email || "",
      linkedin: fields.linkedin || "",
      relationship: fields.relationship || "",
      last_interaction: fields.last_interaction || "",
      tags: ["person"],
      "ai-first": true,
    });
    const body = preambleBlock(`Person note for ${name}. Contact details and a running interaction log; consult before reaching out or when a meeting/lesson references them.`) +
      `\n# ${name}\n\n## About\n${fields.about || ""}\n\n## Contact\n- **Email:** ${fields.email || ""}\n- **LinkedIn:** ${fields.linkedin || ""}\n- **Role:** ${fields.role || ""} ${fields.company ? "@ " + fields.company : ""}\n\n## Interaction Log\n`;
    fs.writeFileSync(file, front + body);
  } else if (Object.keys(fields).length) {
    // Fill any provided fields that are currently empty.
    const { meta } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    const updates = {};
    for (const k of ["role", "company", "email", "linkedin", "relationship"]) {
      if (fields[k] && !meta[k]) updates[k] = fields[k];
    }
    if (Object.keys(updates).length) updateFrontmatter(file, updates);
  }
  return { file, slug, created };
}

// Append a dated line to a person's interaction log and bump last_interaction.
function logInteraction(name, line) {
  const { file } = ensurePerson(name);
  const date = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(file, `- ${date} — ${String(line || "").replace(/\n/g, " ").trim()}\n`);
  updateFrontmatter(file, { last_interaction: date });
  return file;
}

// The [[12_People/<slug>|Name]] wikilink for an attendee.
function personLink(name) {
  return `[[${DIR.people}/${slugify(name)}|${name}]]`;
}

module.exports = { peopleDir, personFile, ensurePerson, logInteraction, personLink };
