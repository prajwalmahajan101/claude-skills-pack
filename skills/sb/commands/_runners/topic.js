#!/usr/bin/env node
// Create or append to a topic note. Topics live at <vault>/topics/<slug>.md.
// If current session has a conversation file, append a "Source" backlink.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { paths, slugify, readSessionMap, VAULT, DIR } = require(path.join(SKILL_LIB, "vault.js"));
const P = paths("_");
const { parseFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));

const arg = process.argv.slice(2).join(" ").trim();
if (!arg) { console.error("Usage: topic.js <slug-or-title>"); process.exit(2); }

const slug = slugify(arg);
const file = path.join(P.topics, `${slug}.md`);
fs.mkdirSync(path.dirname(file), { recursive: true });

const map = readSessionMap();
const conv = Object.values(map).sort((a, b) => (b.lastWriteAt || "").localeCompare(a.lastWriteAt || ""))[0];
const backlink = conv?.file ? `[[${path.basename(conv.file, ".md")}]]` : null;
const ts = new Date().toISOString().slice(0, 16).replace("T", " ");

if (!fs.existsSync(file)) {
  const front = [
    "---",
    "type: topic",
    `slug: ${slug}`,
    `created: ${new Date().toISOString()}`,
    "tags: [topic]",
    "---",
    "",
    `# ${arg}`,
    "",
    "> Evergreen reference. Update freely; sessions append to the Source Log below.",
    "",
    "## Notes",
    "",
    "",
    "## Source Log",
    "",
  ];
  if (backlink) front.push(`- ${ts} — from ${backlink}`);
  fs.writeFileSync(file, front.join("\n") + "\n");
  console.log(`Created: ${DIR.topics}/${slug}.md`);
} else {
  if (backlink) {
    fs.appendFileSync(file, `- ${ts} — from ${backlink}\n`);
    console.log(`Appended source to ${DIR.topics}/${slug}.md`);
  } else {
    console.log(`Topic exists: ${DIR.topics}/${slug}.md (no current session to link)`);
  }
}

// Auto-surface up to 3 related lessons by tag overlap (or slug match in related: field).
const related = findRelatedLessons(slug);
if (related.length) {
  console.log(`\nRelated lessons (${related.length}):`);
  related.forEach(r => console.log(`  - [[${path.basename(r, ".md")}]]`));
}

function findRelatedLessons(topicSlug) {
  const lessonsDir = P.lessons;
  if (!fs.existsSync(lessonsDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(lessonsDir)) {
    if (!f.endsWith(".md")) continue;
    try {
      const text = fs.readFileSync(path.join(lessonsDir, f), "utf8");
      const { meta } = parseFrontmatter(text);
      const related = (meta.related || []).map(s => String(s).toLowerCase());
      const tags = (meta.tags || []).map(t => String(t).toLowerCase().replace(/^#/, "").split("/").pop());
      if (related.includes(topicSlug.toLowerCase()) || tags.includes(topicSlug.toLowerCase())) {
        out.push(f);
      }
    } catch {}
  }
  return out.slice(0, 5);
}
