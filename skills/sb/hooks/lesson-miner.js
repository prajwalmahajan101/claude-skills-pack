#!/usr/bin/env node
// lesson-miner (worker) — opportunistically mines FINISHED, un-mined conversations
// into global lessons at ~/.claude/lessons/. Spawned DETACHED by the SessionStart
// trigger hook so it never blocks a session. Best-effort: any failure exits 0.
//
// Safety:
//  - Recursion guard: the `claude -p` it spawns carries LESSON_MINER=1; if this
//    script ever runs with that env set, it exits immediately (no nested mining).
//  - Cost cap: processes at most MAX_PER_RUN sessions, only those with
//    turn_count >= MIN_TURNS and status "ended" and not yet mined.
//  - Self-capture: the `claude -p` runs with cwd /tmp + SB_INTERNAL=1 so sb's
//    backfill self-capture filter drops its transcript.
//
// Disable entirely with SB_DISABLE=1 or LESSON_MINER_DISABLE=1.

try {
  if (process.env.LESSON_MINER === "1") process.exit(0);            // recursion guard
  if (process.env.SB_DISABLE === "1" || process.env.LESSON_MINER_DISABLE === "1") process.exit(0);

  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { spawnSync } = require("node:child_process");

  const SKILL_LIB = path.join(__dirname, "..", "lib");
  const { readSessionMap, writeSessionMap } = require(path.join(SKILL_LIB, "vault.js"));

  const LESSONS_DIR = path.join(os.homedir(), ".claude", "lessons");
  const INDEX = path.join(LESSONS_DIR, "INDEX.md");
  const CLAUDE_BIN = process.env.SB_CLAUDE_BIN || "claude";
  const MODEL = process.env.LESSON_MINER_MODEL || "claude-haiku-4-5-20251001";
  const MIN_TURNS = Number(process.env.LESSON_MINER_MIN_TURNS || 15);
  const MAX_PER_RUN = Number(process.env.LESSON_MINER_MAX || 1);
  const MAX_TRANSCRIPT = 60000; // chars fed to the model

  if (!fs.existsSync(LESSONS_DIR)) fs.mkdirSync(LESSONS_DIR, { recursive: true });

  const map = readSessionMap();
  // Candidates: ended, big enough, not mined, file still present. Newest first.
  const candidates = Object.entries(map)
    .filter(([, v]) =>
      v && v.status === "ended" && !v.lessonsMined &&
      Number(v.turnCount || 0) >= MIN_TURNS && v.file && fs.existsSync(v.file))
    .sort((a, b) => String(b[1].endedAt || "").localeCompare(String(a[1].endedAt || "")))
    .slice(0, MAX_PER_RUN);

  if (!candidates.length) process.exit(0);

  // Existing lesson slugs (dedup by filename slug) + a compact title list for the model.
  const existingSlugs = new Set(
    fs.existsSync(LESSONS_DIR)
      ? fs.readdirSync(LESSONS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
      : []
  );
  const indexText = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, "utf8") : "";

  for (const [sid, entry] of candidates) {
    let transcript = "";
    try { transcript = fs.readFileSync(entry.file, "utf8"); } catch { continue; }
    if (transcript.length > MAX_TRANSCRIPT) transcript = transcript.slice(0, MAX_TRANSCRIPT) + "\n[truncated]";

    const prompt = buildPrompt(indexText, transcript);
    const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "text"], {
      input: prompt,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      cwd: os.tmpdir(),                                   // scratch cwd → filtered by self-capture guard
      env: { ...process.env, LESSON_MINER: "1", SB_INTERNAL: "1" },
      timeout: 120000,
    });
    // Mark mined regardless of outcome so we never re-spend on the same session.
    map[sid] = { ...entry, lessonsMined: true, lessonsMinedAt: new Date().toISOString() };
    if (r.status !== 0 || !r.stdout) { writeSessionMap(map); continue; }

    const lessons = parseLessons(r.stdout);
    for (const l of lessons) {
      const date = (entry.endedAt || new Date().toISOString()).slice(0, 10);
      let slug = `${date}-${l.slug}`;
      if (existingSlugs.has(slug)) continue;               // dedup
      existingSlugs.add(slug);
      const file = path.join(LESSONS_DIR, `${slug}.md`);
      fs.writeFileSync(file, l.body);
      appendIndex(INDEX, `- \`${slug}.md\` — [${l.tag}] ${l.summary}\n`);
    }
    writeSessionMap(map);
  }
  process.exit(0);

  // ---------- helpers ----------
  function buildPrompt(indexText, transcript) {
    return [
      "You extract DURABLE, TRANSFERABLE engineering lessons from a Claude Code session transcript.",
      "Bar: a lesson must save a future session >=5 minutes or prevent a mistake. Most sessions yield ZERO lessons — that is the expected, correct output. Do NOT invent lessons.",
      "Skip anything trivial, one-off, or purely domain-specific with no transferable insight.",
      "",
      "Do NOT duplicate lessons already captured. Existing lessons index:",
      indexText.slice(0, 4000) || "(none yet)",
      "",
      "OUTPUT FORMAT — output either the literal word NONE, or 1-3 lessons each wrapped EXACTLY like:",
      "<<<LESSON>>>",
      "slug: short-kebab-case-slug",
      "tag: architecture|debugging|tooling|convention|performance|preference|tradeoff|workflow",
      "summary: one-line index summary (<=160 chars)",
      "---",
      "## Decision",
      "<what was decided/found and why>",
      "## Key Insight",
      "<the transferable, specific, actionable lesson>",
      "## Applies When",
      "<when this is relevant in future>",
      "<<<END>>>",
      "",
      "--- BEGIN TRANSCRIPT ---",
      transcript,
      "--- END TRANSCRIPT ---",
    ].join("\n");
  }

  function parseLessons(out) {
    const res = [];
    const re = /<<<LESSON>>>([\s\S]*?)<<<END>>>/g;
    let m;
    while ((m = re.exec(out))) {
      const block = m[1].trim();
      const slug = (block.match(/^slug:\s*(.+)$/m) || [])[1];
      const tag = (block.match(/^tag:\s*(.+)$/m) || [])[1];
      const summary = (block.match(/^summary:\s*(.+)$/m) || [])[1];
      const bodyStart = block.indexOf("---");
      if (!slug || !tag || !summary || bodyStart < 0) continue;
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      const front = `---\ndate: ${new Date().toISOString().slice(0, 10)}\ntags: [${tag.trim()}]\ncontext: auto-mined from a captured session\n---\n\n`;
      res.push({ slug: cleanSlug, tag: tag.trim(), summary: summary.trim(), body: front + block.slice(bodyStart + 3).trim() + "\n" });
    }
    return res;
  }

  function appendIndex(indexPath, line) {
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, "# Lessons Learned\n\nAccumulated decision insights from past sessions.\n\n" + line);
    } else {
      fs.appendFileSync(indexPath, line);
    }
  }
} catch {
  process.exit(0); // never break anything
}
