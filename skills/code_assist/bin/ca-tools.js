#!/usr/bin/env node
"use strict";
/*
 * ca-tools.js — code_assist deterministic backbone.
 *
 * Zero external dependencies (Node >= 18 built-ins only). All EXACT logic lives
 * here so the LLM never has to compute it: stack detection, diff/commit stats,
 * project-structure audit + scaffold, per-repo state I/O, markdown formatting,
 * and integration helpers (github/jira/slack/sonar) that read tokens from env
 * and DRY-RUN external writes by default.
 *
 * Every subcommand prints JSON to stdout (so callers can parse with jq) unless
 * --text is given. Network/mutating actions never fire unless explicitly asked
 * (writes require --confirm; reads require the relevant env token, else no-op).
 *
 * Usage: node ca-tools.js <command> [args]
 *   stack-detect [dir]            detect repo stack(s) + language
 *   diff-stats [--staged]         changed files + insertions/deletions, grouped
 *   structure-audit [dir]         gaps vs the canonical project structure
 *   structure-scaffold <dir> [--lang L] [--apply]   create missing standard files
 *   state-read [dir]              read .code_assist/STATE.md + config.json
 *   state-write [dir] --key k --value v             upsert config.json key
 *   md-format <file...> [--write] normalize markdown (zero-dep)
 *   changelog [--since <tag>]     group commits since last tag (release backing)
 *   version-detect [dir]          find the version source + current value
 *   onboard-scan [dir]            stack + structure + entry-point orientation blob
 *   selfcheck                     which tools/integrations/siblings are configured
 *   recall --context "<text>"     pull relevant prior lessons/memory/risks (provenance)
 *   bridge <status>               detect sibling skills (sb/unabridged) + handoffs
 *   github <pr|ci|issue|release> …                  thin gh wrappers
 *   track <get|transitions|comment|transition> …    Jira REST (dry-run writes)
 *   notify <slack|telegram> --text … [--confirm]    webhook post (dry-run default)
 *   scan <sonar> …                                  Sonar web API (read-only)
 *   graph <status|index|context|impact|detect-changes|query> …  code intel
 *                                 (gitnexus call graph + graphify knowledge graph)
 *   version                       print tool version
 */

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const os = require("node:os");

const VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);

function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function out(obj, opts = {}) {
  const f = opts.text;
  if (f) process.stdout.write(String(obj) + "\n");
  else process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}
function die(msg, code = 1) { process.stderr.write("ca-tools: " + msg + "\n"); process.exit(code); }

function sh(command, args, opts = {}) {
  const r = cp.spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...opts });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim(), error: r.error };
}

function inRepo(dir) {
  const r = sh("git", ["-C", dir || ".", "rev-parse", "--is-inside-work-tree"]);
  return r.status === 0 && r.stdout === "true";
}

// ---------------------------------------------------------------------------
// stack detection
// ---------------------------------------------------------------------------
function detectStack(dir) {
  dir = dir || ".";
  const has = (p) => fs.existsSync(path.join(dir, p));
  const langs = [];
  if (has("pyproject.toml") || has("setup.py") || has("requirements.txt") || has("manage.py")) langs.push("python");
  if (has("go.mod")) langs.push("go");
  if (has("Cargo.toml")) langs.push("rust");
  if (has("package.json")) langs.push("js");
  if (has("pom.xml") || has("build.gradle") || has("build.gradle.kts") || has("settings.gradle")) langs.push("java");
  if (has("terraform") || globMatch(dir, /\.tf$/)) langs.push("terraform");

  // Coarse stack classification for the review router.
  const stacks = [];
  const pkg = safeJSON(path.join(dir, "package.json"));
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
  const frontendHints = ["react", "vue", "svelte", "next", "vite", "@angular/core", "solid-js"];
  const tuiHints = ["ink", "blessed", "bubbletea", "ratatui", "textual", "rich"];
  if (langs.includes("js") && frontendHints.some((h) => deps[h])) stacks.push("frontend");
  if (has("manage.py") || has("pyproject.toml") && depFile(dir, /fastapi|flask|django|starlette/)) stacks.push("backend");
  if (langs.includes("go") || langs.includes("java")) stacks.push("backend");
  if (langs.includes("python") && !stacks.includes("backend")) stacks.push("backend");
  // TUI detection across languages
  if (tuiHints.some((h) => deps[h]) || depFile(dir, /bubbletea|ratatui|textual/) || (langs.includes("rust") && has("Cargo.toml") && depFile(dir, /ratatui|crossterm/))) {
    stacks.push("tui");
  }
  const uniqStacks = [...new Set(stacks)];
  return {
    dir: path.resolve(dir),
    languages: langs,
    stacks: uniqStacks.length ? uniqStacks : (langs.length ? ["backend"] : ["unknown"]),
    monorepo: has("shared") && (has("backend") || has("frontend")),
  };
}

function depFile(dir, re) {
  for (const f of ["pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml"]) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) { try { if (re.test(fs.readFileSync(p, "utf8"))) return true; } catch {} }
  }
  return false;
}
function globMatch(dir, re) {
  try { return fs.readdirSync(dir).some((f) => re.test(f)); } catch { return false; }
}
function safeJSON(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }

// ---------------------------------------------------------------------------
// diff / commit stats
// ---------------------------------------------------------------------------
function diffStats(dir, staged) {
  dir = dir || ".";
  if (!inRepo(dir)) die("not a git repository: " + path.resolve(dir));
  const args = ["-C", dir, "diff", "--numstat"];
  if (staged) args.push("--staged");
  const r = sh("git", args);
  const files = [];
  let ins = 0, del = 0;
  for (const line of r.stdout.split("\n").filter(Boolean)) {
    const [a, d, ...fp] = line.split("\t");
    const file = fp.join("\t");
    const ai = a === "-" ? 0 : parseInt(a, 10) || 0;
    const di = d === "-" ? 0 : parseInt(d, 10) || 0;
    ins += ai; del += di;
    files.push({ file, insertions: ai, deletions: di, group: classifyFile(file) });
  }
  const untracked = staged ? [] : sh("git", ["-C", dir, "ls-files", "--others", "--exclude-standard"]).stdout.split("\n").filter(Boolean);
  return { staged: !!staged, files, untracked, totals: { files: files.length, insertions: ins, deletions: del } };
}

// classify a path into a commit-grouping bucket
function classifyFile(file) {
  const f = file.toLowerCase();
  if (/(^|\/)(test|tests|__tests__|spec)(\/|$)|\.(test|spec)\.[jt]sx?$|_test\.(go|py|rs)$/.test(f)) return "test";
  if (/\.(md|rst|txt)$|(^|\/)docs?\//.test(f)) return "docs";
  if (/(package(-lock)?\.json|pyproject\.toml|go\.(mod|sum)|cargo\.(toml|lock)|requirements.*\.txt|dockerfile|docker-compose|\.ya?ml$|\.toml$|\.ini$|makefile)/.test(f)) return "config";
  if (/\.(css|scss|less)$|\.(prettierrc|editorconfig)/.test(f)) return "style";
  return "code";
}

// ---------------------------------------------------------------------------
// canonical project structure — audit + scaffold
// ---------------------------------------------------------------------------
// The canonical requirements, derived from the main-project audit. `always` are
// language-agnostic; per-language add their own required markers.
const CANON = {
  always: [
    { path: "README.md", kind: "file", why: "project overview" },
    { path: "LICENSE", kind: "file", why: "license" },
    { path: "CHANGELOG.md", kind: "file", why: "change history" },
    { path: "CLAUDE.md", kind: "file", why: "agent guide (seed via /code_assist:onboard)" },
    { path: "docs", kind: "dir", why: "documentation hub" },
    { path: "docs/adr", kind: "dir", why: "architecture decision records (standardize on docs/adr/)" },
    { path: ".github/workflows", kind: "dir", why: "CI" },
    { path: ".gitignore", kind: "file", why: "vcs hygiene" },
  ],
  python: [
    { path: "pyproject.toml", kind: "file", why: "packaging + ruff/mypy config" },
    { path: "tests", kind: "dir", why: "test suite (split unit/integration/e2e)" },
    { path: "src", kind: "dir", why: "src-layout package root", soft: true },
  ],
  go: [
    { path: "go.mod", kind: "file", why: "module" },
    { path: ".golangci.yml", kind: "file", why: "lint config", soft: true },
  ],
  rust: [
    { path: "Cargo.toml", kind: "file", why: "crate/workspace" },
    { path: "rustfmt.toml", kind: "file", why: "format config", soft: true },
  ],
  js: [
    { path: "package.json", kind: "file", why: "package + scripts" },
    { path: "tests", kind: "dir", why: "test suite", soft: true },
  ],
};

// design docs that belong under docs/ (flag if found loose at repo root)
const LOOSE_DOC_RE = /^(HLD|LLD|PRD|RFC|ARCHITECTURE|DESIGN|UX)\.md$/i;

function structureAudit(dir) {
  dir = dir || ".";
  const det = detectStack(dir);
  const req = [...CANON.always];
  for (const lang of det.languages) if (CANON[lang]) req.push(...CANON[lang]);

  const gaps = [];
  for (const r of req) {
    const full = path.join(dir, r.path);
    const exists = fs.existsSync(full);
    if (!exists) gaps.push({ ...r, severity: r.soft ? "warn" : "error" });
  }
  // ADR-naming split: docs/decisions used instead of docs/adr
  if (fs.existsSync(path.join(dir, "docs", "decisions")) && !fs.existsSync(path.join(dir, "docs", "adr"))) {
    gaps.push({ path: "docs/adr", kind: "dir", why: "found docs/decisions/ — standardize on docs/adr/", severity: "warn", rename_from: "docs/decisions" });
  }
  // loose root design docs
  const looseDocs = [];
  try {
    for (const f of fs.readdirSync(dir)) if (LOOSE_DOC_RE.test(f)) looseDocs.push(f);
  } catch {}
  // empty dir smell
  let empty = false;
  try { empty = fs.readdirSync(dir).filter((f) => f !== ".git").length === 0; } catch {}

  const score = Math.max(0, Math.round(100 * (1 - gaps.filter((g) => g.severity === "error").length / Math.max(1, req.length))));
  return {
    dir: path.resolve(dir),
    detected: det,
    required: req.length,
    gaps,
    loose_root_docs: looseDocs,
    empty,
    compliance_score: score,
  };
}

// Scaffold missing standard files/dirs from built-in templates. Idempotent:
// never overwrites an existing path. Dry-run unless --apply.
function structureScaffold(dir, lang, apply) {
  if (!dir) die("structure-scaffold requires a target dir");
  const det = detectStack(dir);
  const language = lang || det.languages[0] || "generic";
  const planned = [];
  const tmplDir = path.join(__dirname, "..", "structure", "templates");

  const items = [
    { path: "README.md", tmpl: "README.md" },
    { path: "LICENSE", tmpl: "LICENSE" },
    { path: "CHANGELOG.md", tmpl: "CHANGELOG.md" },
    { path: "CLAUDE.md", tmpl: "CLAUDE.md" },
    { path: ".gitignore", tmpl: "gitignore" },
    { path: ".editorconfig", tmpl: "editorconfig" },
    { path: "docs/adr/0000-template.md", tmpl: "adr-0000-template.md" },
    { path: "docs/architecture.md", tmpl: "architecture.md" },
    { path: ".github/workflows/ci.yml", tmpl: `ci.${language}.yml`, fallback: "ci.generic.yml" },
  ];

  for (const it of items) {
    const dest = path.join(dir, it.path);
    if (fs.existsSync(dest)) { planned.push({ path: it.path, action: "skip (exists)" }); continue; }
    let body = readTemplate(tmplDir, it.tmpl) ?? (it.fallback ? readTemplate(tmplDir, it.fallback) : null);
    if (body == null) body = defaultStub(it.path, path.basename(dir));
    planned.push({ path: it.path, action: apply ? "create" : "would-create" });
    if (apply) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, body); }
  }
  return { dir: path.resolve(dir), language, applied: !!apply, planned };
}

function readTemplate(tmplDir, name) {
  if (!name) return null;
  const p = path.join(tmplDir, name);
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}
function defaultStub(rel, project) {
  const base = path.basename(rel);
  if (base === "README.md") return `# ${project}\n\nOne-paragraph description of what ${project} does and who it is for.\n\n## Getting started\n\n- Install: see docs.\n- Run: see the Makefile targets.\n`;
  if (base === "CHANGELOG.md") return `# Changelog\n\nAll notable changes are documented here (Keep a Changelog + SemVer).\n\n## [Unreleased]\n`;
  if (base === "LICENSE") return `Copyright (c) ${project}\n\nChoose a license (for example MIT) and replace this file. See https://choosealicense.com/\n`;
  if (base === ".gitignore") return `.env\n.env.*\n*.log\nnode_modules/\ndist/\nbuild/\n__pycache__/\n.venv/\ntarget/\n`;
  if (base === ".editorconfig") return `root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ninsert_final_newline = true\ntrim_trailing_whitespace = true\n`;
  return `<!-- @code_assist-generated placeholder for ${rel}; replace with real content. -->\n`;
}

// ---------------------------------------------------------------------------
// per-repo state (.code_assist/)
// ---------------------------------------------------------------------------
function stateDir(dir) { return path.join(dir || ".", ".code_assist"); }
function stateRead(dir) {
  const sd = stateDir(dir);
  const stateMd = path.join(sd, "STATE.md");
  const cfg = path.join(sd, "config.json");
  return {
    dir: path.resolve(sd),
    exists: fs.existsSync(sd),
    state_md: fs.existsSync(stateMd) ? fs.readFileSync(stateMd, "utf8") : null,
    config: safeJSON(cfg) || {},
  };
}
function stateWrite(dir, key, value) {
  if (!key) die("state-write requires --key");
  const sd = stateDir(dir);
  fs.mkdirSync(sd, { recursive: true });
  const cfg = path.join(sd, "config.json");
  const data = safeJSON(cfg) || {};
  data[key] = coerce(value);
  fs.writeFileSync(cfg, JSON.stringify(data, null, 2) + "\n");
  return { config: cfg, set: { [key]: data[key] } };
}
function coerce(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v != null && /^-?\d+(\.\d+)?$/.test(String(v))) return Number(v);
  return v;
}

// ---------------------------------------------------------------------------
// release helpers — changelog + version detection (deterministic; LLM renders prose)
// ---------------------------------------------------------------------------
function lastTag(dir) {
  const r = sh("git", ["-C", dir || ".", "describe", "--tags", "--abbrev=0"]);
  return r.status === 0 && r.stdout ? r.stdout : null;
}
function changelog(dir, since) {
  dir = dir || ".";
  if (!inRepo(dir)) die("not a git repository: " + path.resolve(dir));
  const tag = since || lastTag(dir);
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const r = sh("git", ["-C", dir, "log", range, "--no-merges", "--pretty=%s"]);
  const groups = {};
  for (const subj of r.stdout.split("\n").filter(Boolean)) {
    const m = subj.match(/^(\w+)(\([^)]*\))?(!)?:\s*(.*)$/);
    const type = m ? m[1].toLowerCase() : "other";
    const bucket = ({ feat: "Added", fix: "Fixed", perf: "Changed", refactor: "Changed",
      docs: "Docs", test: "Tests", chore: "Chore", style: "Chore" })[type] || "Other";
    (groups[bucket] = groups[bucket] || []).push(m ? m[4] : subj);
  }
  return { since: tag, range, count: r.stdout.split("\n").filter(Boolean).length, groups };
}
function versionDetect(dir) {
  dir = dir || ".";
  const tries = [
    { file: "pyproject.toml", re: /^\s*version\s*=\s*["']([^"']+)["']/m },
    { file: "package.json", json: true, key: "version" },
    { file: "Cargo.toml", re: /^\s*version\s*=\s*["']([^"']+)["']/m },
  ];
  for (const t of tries) {
    const p = path.join(dir, t.file);
    if (!fs.existsSync(p)) continue;
    if (t.json) { const j = safeJSON(p); if (j && j[t.key]) return { source: t.file, version: j[t.key] }; }
    else { const m = fs.readFileSync(p, "utf8").match(t.re); if (m) return { source: t.file, version: m[1] }; }
  }
  const tag = lastTag(dir);
  return tag ? { source: "git-tag", version: tag.replace(/^v/, "") } : { source: null, version: null };
}

// ---------------------------------------------------------------------------
// onboard-scan — one orientation blob (stack + structure + entry points)
// ---------------------------------------------------------------------------
function onboardScan(dir) {
  dir = dir || ".";
  const det = detectStack(dir);
  const audit = structureAudit(dir);
  const entries = [];
  const candidates = ["main.py", "app.py", "manage.py", "src/main.rs", "cmd", "main.go",
    "src/index.ts", "src/index.js", "index.js", "src/main.ts", "src/App.tsx"];
  for (const c of candidates) if (fs.existsSync(path.join(dir, c))) entries.push(c);
  let scripts = {};
  const pkg = safeJSON(path.join(dir, "package.json"));
  if (pkg && pkg.scripts) scripts = pkg.scripts;
  return {
    dir: path.resolve(dir),
    languages: det.languages, stacks: det.stacks, monorepo: det.monorepo,
    compliance_score: audit.compliance_score,
    entry_points: entries,
    scripts,
    version: versionDetect(dir),
    doc_gaps: audit.gaps.filter((g) => g.severity === "error").map((g) => g.path),
  };
}

// ---------------------------------------------------------------------------
// selfcheck — which integrations/tools are configured (never calls out)
// ---------------------------------------------------------------------------
function selfcheck() {
  const env = process.env;
  return {
    tools: { gh: ghAvailable(), gitnexus: have("gitnexus"), graphify: have("graphify"),
      deno: sh("deno", ["--version"]).status === 0, semgrep: sh("semgrep", ["--version"]).status === 0 },
    integrations: {
      jira: !!(env.JIRA_BASE_URL && env.JIRA_EMAIL && env.JIRA_TOKEN),
      slack: !!env.SLACK_WEBHOOK_URL,
      telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      sonar: !!(env.SONAR_HOST_URL && env.SONAR_TOKEN),
    },
    siblings: {
      sb: fs.existsSync(path.join(os.homedir(), ".claude", "skills", "sb")),
      unabridged: fs.existsSync(path.join(os.homedir(), ".claude", "skills", "unabridged")),
    },
  };
}

// ---------------------------------------------------------------------------
// recall — reverse bridge: pull relevant prior lessons / memory / risks so the
// LLM reasons WITH accumulated knowledge. Self-contained (reads the three raw
// stores directly); enriches with sb's semantic retriever when sb is present.
// Every item carries a file:line `ref` (provenance) — nothing is invented.
// ---------------------------------------------------------------------------
const RISK_TAGS = /\b(risk|gotcha|pitfall|footgun|regression|caution|danger|breaking|security|antipattern|anti-pattern)\b/i;
const RISK_PHRASE = /\b(never|don'?t|do not|avoid|must not|beware|careful|fails? (?:closed|open)|breaks?)\b/i;
const STOPWORDS = new Set(("the a an and or of to in on for with is are be this that it at by from as into your my our " +
  "not no do does how why what when where which who then than into via per use used using add adds get set new").split(" "));

function homeDir(sub) { return path.join(os.homedir(), sub); }
function lessonsDir() { return process.env.CA_LESSONS_DIR || homeDir(".claude/lessons"); }
function rememberDir() { return process.env.CA_REMEMBER_DIR || homeDir(".remember"); }
function memoryDirFor(dir) {
  if (process.env.CA_MEMORY_DIR) return process.env.CA_MEMORY_DIR;
  // Harness memory is keyed by the project root; prefer the git top-level, else the dir.
  const top = sh("git", ["-C", dir || ".", "rev-parse", "--show-toplevel"]);
  const abs = top.status === 0 && top.stdout ? top.stdout : path.resolve(dir || ".");
  const slug = abs.replace(/[/_.]/g, "-");
  return path.join(os.homedir(), ".claude", "projects", slug, "memory");
}

function tokenize(s) {
  return (s || "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
function overlapScore(ctxToks, text, tag) {
  const cand = [...new Set(tokenize(text + " " + (tag || "")))];
  let s = 0;
  for (const c of ctxToks) {
    for (const t of cand) {
      // exact, or shared >=4-char prefix (cheap stemming: commit~committing, secret~secrets).
      if (c === t) { s += 2; break; }
      if (c.length >= 4 && t.length >= 4 && (c.startsWith(t.slice(0, 4)) && t.startsWith(c.slice(0, 4)))) { s += 1; break; }
    }
  }
  return s;
}

// Read `- \`slug.md\` — [tag] summary` lines from the lessons INDEX (cheap, no per-file open).
function readLessons() {
  const dir = lessonsDir();
  const idx = path.join(dir, "INDEX.md");
  const out = [];
  let body;
  try { body = fs.readFileSync(idx, "utf8"); } catch { return out; }
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^-\s+`([^`]+)`\s*[—-]+\s*(?:\[([^\]]+)\]\s*)?(.+)$/);
    if (!m) continue;
    out.push({ text: m[3].trim(), tag: (m[2] || "").trim(), file: path.join(dir, m[1]), ref: `${idx}:${i + 1}` });
  }
  return out;
}

// Read `- [Title](file.md) — hook` lines from the project's harness MEMORY.md.
function readMemory(dir) {
  const mdir = memoryDirFor(dir);
  const idx = path.join(mdir, "MEMORY.md");
  const out = [];
  let body;
  try { body = fs.readFileSync(idx, "utf8"); } catch { return out; }
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[—-]+\s*(.+)$/);
    if (!m) continue;
    out.push({ text: `${m[1]} — ${m[3].trim()}`, tag: "", file: path.join(mdir, m[2]), ref: `${idx}:${i + 1}` });
  }
  return out;
}

function readRemember() {
  const p = path.join(rememberDir(), "recent.md");
  const out = [];
  let body;
  try { body = fs.readFileSync(p, "utf8"); } catch { return out; }
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^[-*]\s*/, "").trim();
    if (line && !line.startsWith("#") && !line.startsWith("```")) {
      out.push({ text: line.slice(0, 200), tag: "", file: p, ref: `${p}:${i + 1}` });
    }
  }
  return out;
}

// Best-effort sb enrichment: verbatim highlights with provenance. Never throws.
function sbHighlights(context, limit) {
  const runner = path.join(os.homedir(), ".claude", "skills", "sb", "commands", "_runners", "ask-highlights.js");
  if (!fs.existsSync(runner)) return [];
  const r = sh("node", [runner, context, "--limit", String(limit)], { timeout: 8000 });
  if (r.status !== 0 || !r.stdout) return [];
  const out = [];
  const lines = r.stdout.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].match(/^•\s*(.+)$/);
    if (!t) continue;
    const ref = (lines[i + 1] || "").match(/—\s*(.+:\d+)\s*$/);
    out.push({ text: t[1].trim(), tag: "", source: "sb", ref: ref ? ref[1] : "sb:vault" });
  }
  return out;
}

function isRisk(item) { return RISK_TAGS.test(item.tag) || RISK_TAGS.test(item.text) || RISK_PHRASE.test(item.text); }

function recall(args) {
  const f = flags(args);
  const context = f.context || f._.join(" ") || "";
  const limit = Number(f.limit || 5);
  const kinds = String(f.kinds || "lessons,risks,memory").split(",").map((k) => k.trim());
  const dir = f.dir || ".";
  const ctxToks = tokenize(context);
  const rank = (items, src) => items
    .map((it) => ({ ...it, source: it.source || src, score: context ? overlapScore(ctxToks, it.text, it.tag) : 1 }))
    .filter((it) => it.score > 0 || !context)
    .sort((a, b) => b.score - a.score);

  const lessonItems = readLessons();
  const memoryItems = readMemory(dir);
  const rememberItems = readRemember();

  let lessons = rank(lessonItems, "lessons");
  const memory = rank(memoryItems.concat(rememberItems.map((r) => ({ ...r, source: "remember" }))), "memory");
  // sb enrichment (verbatim, provenance) — merged into lessons, deduped by text.
  // CA_RECALL_SB=0 disables it (keeps tier-1 fully isolated for deterministic tests).
  if (context && process.env.CA_RECALL_SB !== "0" && selfcheck().siblings.sb) {
    const seen = new Set(lessons.map((l) => l.text));
    for (const h of sbHighlights(context, limit)) if (!seen.has(h.text)) { lessons.push({ ...h, score: 1 }); seen.add(h.text); }
  }
  // risks = risk-flagged items from CURATED sources (lessons + memory), never the
  // noisy remember activity log; deduped, ranked.
  const riskPool = lessons.concat(memory).filter((it) => it.source !== "remember" && isRisk(it));
  const risks = riskPool.sort((a, b) => (b.score || 0) - (a.score || 0));

  const clip = (arr) => arr.slice(0, limit).map(({ text, tag, source, ref }) => ({ text, tag: tag || undefined, source, ref }));
  const result = { context, dir: path.resolve(dir), sources: {
    lessons: lessonItems.length, memory: memoryItems.length, remember: rememberItems.length,
    sb: selfcheck().siblings.sb } };
  if (kinds.includes("lessons")) result.lessons = clip(lessons);
  if (kinds.includes("risks")) result.risks = clip(risks);
  if (kinds.includes("memory")) result.memory = clip(memory);
  return result;
}

// ---------------------------------------------------------------------------
// bridge — detect sibling skills + describe handoffs (now bidirectional)
// ---------------------------------------------------------------------------
function bridge(args) {
  const f = flags(args);
  const sub = f._[0] || "status";
  const sc = selfcheck();
  if (sub === "status") {
    const r = recall(["--limit", "0", "--kinds", "lessons"]);
    return {
      siblings: sc.siblings,
      handoffs: {
        sb: sc.siblings.sb ? "journal/adr/review/decision artifacts -> /sb:sync-project ingests into the vault"
          : "sb not installed (optional)",
        unabridged: sc.siblings.unabridged ? "full-output families (plan execute, onboard, scaffold) honor the no-truncation rule"
          : "unabridged not installed (optional)",
      },
      pull: {
        available: (r.sources.lessons + r.sources.memory + r.sources.remember) > 0 || sc.siblings.sb,
        sources: r.sources,
        note: "reverse channel: `ca-tools recall --context \"<task>\"` surfaces lessons/memory/risks with provenance",
      },
    };
  }
  return { ok: false, reason: "usage: bridge <status>" };
}

// ---------------------------------------------------------------------------
// markdown formatter (zero-dep, conservative)
// ---------------------------------------------------------------------------
function formatMarkdown(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const outL = [];
  let inFence = false, fenceTok = "";
  for (let raw of lines) {
    const fence = raw.match(/^(\s*)(```+|~~~+)/);
    if (fence) {
      const tok = fence[2];
      if (!inFence) { inFence = true; fenceTok = tok[0]; }
      else if (tok[0] === fenceTok) { inFence = false; fenceTok = ""; }
      outL.push(raw.replace(/[ \t]+$/, ""));
      continue;
    }
    if (inFence) { outL.push(raw); continue; }        // never touch code blocks
    let line = raw.replace(/[ \t]+$/, "");             // trailing ws
    line = line.replace(/\t/g, "  ");                  // tabs -> 2 spaces (outside code)
    // ASCII-normalize common smart punctuation (outside code)
    line = line.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
               .replace(/[–—]/g, "-").replace(/…/g, "...").replace(/ /g, " ");
    outL.push(line);
  }
  // collapse 3+ blank lines to 1, ensure single trailing newline
  let text = outL.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "") + "\n";
  return text;
}

function mdFormatCmd(f) {
  const files = f._;
  if (!files.length) die("md-format requires file paths");
  const results = [];
  for (const file of files) {
    let src; try { src = fs.readFileSync(file, "utf8"); } catch (e) { results.push({ file, error: e.message }); continue; }
    const formatted = formatMarkdown(src);
    const changed = formatted !== src;
    if (changed && f.write) fs.writeFileSync(file, formatted);
    results.push({ file, changed, written: !!(changed && f.write) });
  }
  return { wrote: !!f.write, results };
}

// ---------------------------------------------------------------------------
// integrations — github (gh), track (jira), notify (slack/telegram), scan (sonar)
// ---------------------------------------------------------------------------
function ghAvailable() { return sh("gh", ["--version"]).status === 0; }

function github(args) {
  const f = flags(args);
  const sub = f._[0];
  if (!ghAvailable()) return { ok: false, reason: "gh CLI not found; install GitHub CLI or use git." };
  switch (sub) {
    case "ci": {
      const r = sh("gh", ["run", "list", "--limit", String(f.limit || 5), "--json", "status,conclusion,name,headBranch,createdAt"]);
      return r.status === 0 ? { ok: true, runs: safeParse(r.stdout) } : { ok: false, reason: r.stderr };
    }
    case "pr": {
      if (f.list || !f._[1]) { const r = sh("gh", ["pr", "list", "--json", "number,title,state,headRefName", "--limit", String(f.limit || 10)]); return r.status === 0 ? { ok: true, prs: safeParse(r.stdout) } : { ok: false, reason: r.stderr }; }
      const r = sh("gh", ["pr", "view", String(f._[1]), "--json", "number,title,state,body,url"]);
      return r.status === 0 ? { ok: true, pr: safeParse(r.stdout) } : { ok: false, reason: r.stderr };
    }
    case "issue": {
      const r = sh("gh", ["issue", "view", String(f._[1]), "--json", "number,title,body,state,labels"]);
      return r.status === 0 ? { ok: true, issue: safeParse(r.stdout) } : { ok: false, reason: r.stderr };
    }
    default:
      return { ok: false, reason: "usage: github <ci|pr|issue> …" };
  }
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

// Jira REST v3. Reads JIRA_BASE_URL/JIRA_EMAIL/JIRA_TOKEN. Writes are DRY-RUN
// unless --confirm is passed.
function track(args) {
  const f = flags(args);
  const sub = f._[0];
  const base = process.env.JIRA_BASE_URL, email = process.env.JIRA_EMAIL, token = process.env.JIRA_TOKEN;
  const configured = base && email && token;
  const auth = configured ? "Basic " + Buffer.from(`${email}:${token}`).toString("base64") : null;
  const key = f._[1];

  if (!configured && sub !== "help") {
    return { ok: false, configured: false, hint: "set JIRA_BASE_URL, JIRA_EMAIL, JIRA_TOKEN to enable Jira; commands no-op until then." };
  }
  switch (sub) {
    case "get":
      return httpJSON("GET", `${base}/rest/api/3/issue/${key}?fields=summary,status,assignee,issuetype`, auth).then((r) => ({ ok: r.ok, issue: r.body }));
    case "transitions":
      return httpJSON("GET", `${base}/rest/api/3/issue/${key}/transitions`, auth).then((r) => ({ ok: r.ok, transitions: r.body }));
    case "comment": {
      const body = { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: String(f.text || "") }] }] } };
      if (!f.confirm) return Promise.resolve({ ok: true, dry_run: true, would_POST: `${base}/rest/api/3/issue/${key}/comment`, payload: body });
      return httpJSON("POST", `${base}/rest/api/3/issue/${key}/comment`, auth, body).then((r) => ({ ok: r.ok, result: r.body }));
    }
    case "transition": {
      const body = { transition: { id: String(f.to || "") } };
      if (!f.confirm) return Promise.resolve({ ok: true, dry_run: true, would_POST: `${base}/rest/api/3/issue/${key}/transitions`, payload: body });
      return httpJSON("POST", `${base}/rest/api/3/issue/${key}/transitions`, auth, body).then((r) => ({ ok: r.ok, result: r.body || "transitioned" }));
    }
    default:
      return Promise.resolve({ ok: false, reason: "usage: track <get|transitions|comment|transition> <KEY> [--text|--to] [--confirm]" });
  }
}

function notify(args) {
  const f = flags(args);
  const sub = f._[0];
  const text = f.text || f._.slice(1).join(" ");
  if (sub === "slack") {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return Promise.resolve({ ok: false, configured: false, hint: "set SLACK_WEBHOOK_URL to enable Slack." });
    if (!f.confirm) return Promise.resolve({ ok: true, dry_run: true, would_POST: "SLACK_WEBHOOK_URL", payload: { text } });
    return httpJSON("POST", url, null, { text }).then((r) => ({ ok: r.ok, status: r.status }));
  }
  if (sub === "telegram") {
    const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
    if (!tok || !chat) return Promise.resolve({ ok: false, configured: false, hint: "set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID." });
    const url = `https://api.telegram.org/bot${tok}/sendMessage`;
    if (!f.confirm) return Promise.resolve({ ok: true, dry_run: true, would_POST: "telegram sendMessage", payload: { chat_id: chat, text } });
    return httpJSON("POST", url, null, { chat_id: chat, text }).then((r) => ({ ok: r.ok, status: r.status }));
  }
  return Promise.resolve({ ok: false, reason: "usage: notify <slack|telegram> --text … [--confirm]" });
}

function scan(args) {
  const f = flags(args);
  const sub = f._[0];
  if (sub === "sonar") {
    const host = process.env.SONAR_HOST_URL, token = process.env.SONAR_TOKEN, key = f.project || process.env.SONAR_PROJECT_KEY;
    if (!host || !token) return Promise.resolve({ ok: false, configured: false, hint: "set SONAR_HOST_URL + SONAR_TOKEN (+ --project) to pull findings." });
    const auth = "Basic " + Buffer.from(`${token}:`).toString("base64");
    return httpJSON("GET", `${host}/api/issues/search?componentKeys=${encodeURIComponent(key || "")}&resolved=false&ps=100`, auth)
      .then((r) => ({ ok: r.ok, issues: r.body && r.body.issues ? r.body.issues.map((i) => ({ key: i.key, rule: i.rule, severity: i.severity, component: i.component, line: i.line, message: i.message })) : [], total: r.body && r.body.total }));
  }
  return Promise.resolve({ ok: false, reason: "usage: scan sonar [--project KEY]" });
}

// ---------------------------------------------------------------------------
// code intelligence — gitnexus (call graph) + graphify (knowledge graph)
// Both are optional external CLIs; degrade gracefully when absent. All actions
// here are READ-ONLY analysis (indexing writes only to the tool's own cache).
// ---------------------------------------------------------------------------
function have(bin) { return sh(bin, ["--version"]).status === 0 || sh(bin, ["--help"]).status === 0; }

function graph(args) {
  const f = flags(args);
  const sub = f._[0];
  const target = f._[1] || ".";
  const gnx = have("gitnexus");
  const gfy = have("graphify");
  switch (sub) {
    case "status":
      return { ok: true, gitnexus: gnx, graphify: gfy,
        hint: gnx || gfy ? undefined : "install gitnexus and/or graphify for code intelligence." };
    case "index": {
      // gitnexus analyze indexes the call graph; graphify builds graph.json.
      if (gnx) { const r = sh("gitnexus", ["analyze", target], { timeout: 1000 * 60 * 10 }); return { ok: r.status === 0, tool: "gitnexus", stdout: tail(r.stdout), stderr: tail(r.stderr) }; }
      if (gfy) { const r = sh("graphify", ["update", target]); return { ok: r.status === 0, tool: "graphify", stdout: tail(r.stdout) }; }
      return { ok: false, reason: "neither gitnexus nor graphify installed." };
    }
    case "context": {
      if (!gnx) return { ok: false, reason: "gitnexus not installed (needed for symbol context)." };
      const r = sh("gitnexus", ["context", f._[1] || ""], { timeout: 1000 * 120 });
      return { ok: r.status === 0, symbol: f._[1], out: r.stdout, stderr: tail(r.stderr) };
    }
    case "impact": {
      // blast radius: what breaks if you change this symbol
      if (!gnx) return { ok: false, reason: "gitnexus not installed (needed for impact/blast-radius)." };
      const r = sh("gitnexus", ["impact", f._[1] || ""], { timeout: 1000 * 120 });
      return { ok: r.status === 0, target: f._[1], out: r.stdout, stderr: tail(r.stderr) };
    }
    case "detect-changes": {
      // map the current git diff to indexed symbols + affected execution flows
      if (!gnx) return { ok: false, reason: "gitnexus not installed (needed for detect-changes)." };
      const r = sh("gitnexus", ["detect-changes"], { cwd: target, timeout: 1000 * 120 });
      return { ok: r.status === 0, out: r.stdout, stderr: tail(r.stderr) };
    }
    case "query": {
      const q = f._.slice(1).join(" ");
      if (gnx) { const r = sh("gitnexus", ["query", q], { timeout: 1000 * 120 }); return { ok: r.status === 0, tool: "gitnexus", out: r.stdout }; }
      if (gfy) { const r = sh("graphify", ["query", q]); return { ok: r.status === 0, tool: "graphify", out: r.stdout }; }
      return { ok: false, reason: "neither gitnexus nor graphify installed." };
    }
    default:
      return { ok: false, reason: "usage: graph <status|index|context|impact|detect-changes|query> [args]" };
  }
}
function tail(s, n = 40) { const l = String(s || "").split("\n"); return l.length > n ? l.slice(-n).join("\n") : String(s || ""); }

// minimal fetch-based JSON HTTP (Node 18+ global fetch)
async function httpJSON(method, url, auth, body) {
  const headers = { "Accept": "application/json" };
  if (auth) headers["Authorization"] = auth;
  if (body) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let parsed = null; const txt = await res.text();
    try { parsed = txt ? JSON.parse(txt) : null; } catch { parsed = txt; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e.message } };
  }
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------
async function main() {
  const f = flags(rest);
  switch (cmd) {
    case "version": return out({ name: "ca-tools", version: VERSION });
    case "stack-detect": return out(detectStack(f._[0] || "."));
    case "diff-stats": return out(diffStats(f._[0] || ".", !!f.staged));
    case "structure-audit": return out(structureAudit(f._[0] || "."));
    case "structure-scaffold": return out(structureScaffold(f._[0], f.lang, !!f.apply));
    case "state-read": return out(stateRead(f._[0] || "."));
    case "state-write": return out(stateWrite(f._[0] || ".", f.key, f.value));
    case "md-format": return out(mdFormatCmd(f));
    case "changelog": return out(changelog(f._[0] || ".", f.since));
    case "version-detect": return out(versionDetect(f._[0] || "."));
    case "onboard-scan": return out(onboardScan(f._[0] || "."));
    case "selfcheck": return out(selfcheck());
    case "recall": return out(recall(rest));
    case "github": return out(github(rest));
    case "track": return out(await track(rest));
    case "notify": return out(await notify(rest));
    case "scan": return out(await scan(rest));
    case "graph": return out(graph(rest));
    case "bridge": return out(bridge(rest));
    case undefined: return die("no command. see header for usage.", 2);
    default: return die("unknown command: " + cmd, 2);
  }
}

// Run as a CLI when invoked directly; export pure helpers when require()d (tests).
if (require.main === module) {
  main().catch((e) => die(e.stack || String(e)));
} else {
  module.exports = {
    detectStack, classifyFile, structureAudit, structureScaffold,
    formatMarkdown, coerce, changelog, versionDetect, onboardScan, selfcheck,
    track, notify, bridge, flags, recall,
  };
}
