#!/usr/bin/env node
// Analyze unanalyzed conversations (or one specific session_id).
// Writes lessons/<date>-<slug>.md, appends to project lessons.md, adds action items to kanban,
// merges tags into conversation frontmatter, updates analyzed=true.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { paths, readSessionMap, writeSessionMap, slugify, VAULT } = require(path.join(SKILL_LIB, "vault.js"));
const { parseFrontmatter, fm, updateFrontmatter } = require(path.join(SKILL_LIB, "markdown.js"));
const { analyzeConversation } = require(path.join(SKILL_LIB, "analyzer.js"));
const { addTask } = require(path.join(SKILL_LIB, "kanban.js"));
const { tagFile, mergeTags, rebuildTagsIndex } = require(path.join(SKILL_LIB, "tagger.js"));
const { suggest, writeConnection } = require(path.join(SKILL_LIB, "connector.js"));

const AUTO_CONNECT_THRESHOLD = parseFloat(process.env.SB_AUTO_CONNECT_THRESHOLD || "1.5");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const positional = args.filter(a => !a.startsWith("--"));
const arg = positional[0];
const map = readSessionMap();

const candidates = [];
for (const [sid, info] of Object.entries(map)) {
  if (arg && sid !== arg && !sid.startsWith(arg)) continue;
  if (!info.file || !fs.existsSync(info.file)) continue;
  try {
    const { meta } = parseFrontmatter(fs.readFileSync(info.file, "utf8"));
    if (meta.analyzed === true && !arg && !FORCE) continue;
    candidates.push({ sid, info, meta });
  } catch {}
}

if (!candidates.length) {
  console.log("(nothing to analyze)");
  process.exit(0);
}

console.log(`Processing ${candidates.length} conversation${candidates.length === 1 ? "" : "s"}…`);
let totalLessons = 0, totalActions = 0, totalTags = 0;
const errLog = path.join(VAULT, "_meta", "analysis-errors.log");

for (const c of candidates) {
  try {
    const result = analyzeConversation(c.info.file);
    const slug = c.info.project;
    const p = paths(slug);

    // 1. Write each lesson as its own root-level note (structured body from analyzer)
    const lessonFiles = [];
    for (const lesson of result.lessons || []) {
      const date = new Date().toISOString().slice(0, 10);
      const lslug = slugify(lesson.title);
      const lfile = path.join(p.lessons, `${date}-${lslug}.md`);
      const front = {
        type: "lesson",
        date,
        source_session: c.sid,
        source_project: slug,
        tags: mergeTags(lesson.tags || []),
        related: lesson.related_concepts || [],
      };
      // FORCE re-analysis: if lesson with same slug exists, suffix with timestamp.
      let outFile = lfile;
      if (fs.existsSync(outFile)) {
        outFile = path.join(p.lessons, `${date}-${lslug}-${Date.now().toString(36).slice(-4)}.md`);
      }
      const body = `# ${lesson.title}\n\n${lesson.body}\n\n## Source\n[[${path.basename(c.info.file, ".md")}]]\n`;
      fs.writeFileSync(outFile, fm(front) + body);
      lessonFiles.push(path.relative(VAULT, outFile));
      totalLessons++;
    }

    // 2. Append takeaways + lessons to project lessons.md
    if ((result.lessons || []).length || (result.takeaways || []).length) {
      const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
      const lines = [`\n## ${ts} — session ${c.sid.slice(0, 8)}`, ""];
      if (result.summary) lines.push(`> ${result.summary}`, "");
      for (const l of result.lessons || []) lines.push(`- **${l.title}** — ${l.body}`);
      if ((result.takeaways || []).length) {
        lines.push("", "_Takeaways:_");
        for (const t of result.takeaways) lines.push(`- ${t}`);
      }
      fs.appendFileSync(p.projectLessons, lines.join("\n") + "\n");
    }

    // 3. Add action items to kanban To Do
    for (const a of result.action_items || []) {
      addTask(p.projectKanban, slug, a.text, { tags: a.tags || [], due: a.due || null });
      totalActions++;
    }

    // 4. Merge tags into conversation frontmatter + tag the new lesson files
    const llmTags = mergeTags(result.suggested_tags || [], ...(result.lessons || []).map((l) => l.tags || []));
    const newTags = tagFile(c.info.file, llmTags);
    totalTags += newTags.length;
    for (const lf of lessonFiles) tagFile(path.join(VAULT, lf), llmTags);

    // 5. Mark analyzed
    updateFrontmatter(c.info.file, {
      analyzed: true,
      analysis_summary: result.summary || null,
    });

    // 6. Auto-connections: for each new lesson, suggest links and auto-create MOC if strong match
    let autoConnections = 0;
    for (const lrel of lessonFiles) {
      const lpath = path.join(VAULT, lrel);
      const ranked = suggest(lpath, 5);
      const strong = ranked.filter(r => r.score >= AUTO_CONNECT_THRESHOLD);
      if (strong.length >= 1) {
        // Theme = the most-shared tag, or lesson title slug if none shared
        const tagFreq = {};
        for (const r of strong) for (const t of r.sharedTags) tagFreq[t] = (tagFreq[t] || 0) + 1;
        const themeTag = Object.entries(tagFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
        const theme = themeTag ? themeTag.replace(/^#/, "").replace(/\//g, "-") : path.basename(lpath, ".md");
        writeConnection(theme, strong.map(r => r.note.file), lpath);
        autoConnections++;
      }
    }

    console.log(`  ✓ ${c.sid.slice(0, 8)}: ${(result.lessons || []).length} lessons, ${(result.takeaways || []).length} takeaways, ${(result.action_items || []).length} action items, ${newTags.length} tags${autoConnections ? `, ${autoConnections} auto-MOCs` : ""}`);
  } catch (e) {
    fs.mkdirSync(path.dirname(errLog), { recursive: true });
    fs.appendFileSync(errLog, `${new Date().toISOString()} ${c.sid} ${e.message}\n`);
    console.log(`  ✗ ${c.sid.slice(0, 8)}: ${e.message}`);
  }
}

rebuildTagsIndex();
console.log(`\nTotal: ${totalLessons} lessons, ${totalActions} action items, ${totalTags} tags merged.`);
