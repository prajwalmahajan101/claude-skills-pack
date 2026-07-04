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
 *   selfcheck                     which tools/integrations are configured
 *   recall --context "<text>"     pull relevant prior lessons/memory/risks (provenance)
 *   secret-scan --staged|<paths>  detect committed secrets (masked; never prints values)
 *   deps-audit [dir]              read-only vuln audit (npm/pip/cargo/go)
 *   env-check [dir]               .env vs .env.example key drift (names only)
 *   install-git-hooks [dir] [--apply]     write .githooks + core.hooksPath (dry-run default)
 *   uninstall-git-hooks [dir] [--apply]   revert core.hooksPath
 *   incident-scaffold --title T [--apply] next-numbered docs/incidents/NNNN-*.md (+ base tag)
 *   github <pr|ci|issue|release> …                  thin gh wrappers
 *   track <get|transitions|comment|transition> …    Jira REST (dry-run writes)
 *   notify <slack|telegram> --text … [--confirm]    webhook post (dry-run default)
 *   scan <sonar> …                                  Sonar web API (read-only)
 *   graph <status|index|context|impact|detect-changes|query|review-prep> …  code intel
 *                                 (gitnexus call graph + graphify knowledge graph;
 *                                  review-prep = blast-radius table for a review)
 *   version                       print tool version
 */

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const os = require("node:os");

const VERSION = "0.7.0";

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
  };
}

// ---------------------------------------------------------------------------
// recall — pull relevant prior lessons / memory / risks so the LLM reasons WITH
// accumulated knowledge. Self-contained: reads the three harness stores directly
// (global lessons, the project's MEMORY.md, ~/.remember).
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

  const lessons = rank(lessonItems, "lessons");
  const memory = rank(memoryItems.concat(rememberItems.map((r) => ({ ...r, source: "remember" }))), "memory");
  // risks = risk-flagged items from CURATED sources (lessons + memory), never the
  // noisy remember activity log; deduped, ranked.
  const riskPool = lessons.concat(memory).filter((it) => it.source !== "remember" && isRisk(it));
  const risks = riskPool.sort((a, b) => (b.score || 0) - (a.score || 0));

  const clip = (arr) => arr.slice(0, limit).map(({ text, tag, source, ref }) => ({ text, tag: tag || undefined, source, ref }));
  const result = { context, dir: path.resolve(dir), sources: {
    lessons: lessonItems.length, memory: memoryItems.length, remember: rememberItems.length } };
  if (kinds.includes("lessons")) result.lessons = clip(lessons);
  if (kinds.includes("risks")) result.risks = clip(risks);
  if (kinds.includes("memory")) result.memory = clip(memory);
  return result;
}

// ---------------------------------------------------------------------------
// secure — enforce what the plugin preaches: secret-scan, dep audit, env hygiene.
// Zero-dep detectors (shell to gitleaks/audit tools when present). Never PRINTS a
// secret value — always masked. All reads; deps-audit never mutates.
// ---------------------------------------------------------------------------
const SECRET_RULES = [
  { rule: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { rule: "slack-token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { rule: "github-token", re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/ },
  { rule: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { rule: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  // allows compound identifiers (db_secret, secret_token, api_key_prod, X_AUTH_TOKEN).
  { rule: "generic-secret", re: /(?:^|[^A-Za-z0-9_])(?:[A-Za-z0-9]+[_-])?(?:api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token|access[_-]?key)[A-Za-z0-9_-]*\s*[:=]\s*['"]?([^\s'"#]{8,})['"]?/i, group: 1 },
];
// values that a generic-secret match should IGNORE (placeholders / env refs, not real secrets).
const SECRET_PLACEHOLDER = /^(?:\$|process\.env|os\.(?:getenv|environ)|env\[|<|\{\{|example|changeme|your[_-]|xxx|todo|null|none|true|false|redacted|\*+)/i;

function maskSecret(s) {
  if (s.length <= 6) return "*".repeat(s.length);
  return s.slice(0, 4) + "*".repeat(Math.min(s.length - 6, 12)) + s.slice(-2);
}
function loadSecretsIgnore(dir) {
  try { return fs.readFileSync(path.join(dir, ".ca-secretsignore"), "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#")); } catch { return []; }
}
function stagedContent(dir, file, timeout) {
  const r = sh("git", ["-C", dir, "show", ":" + file], timeout ? { timeout } : {});
  return r.status === 0 ? r.stdout : null;
}
function scanText(text, file, findings, ignore) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/ca:allow-secret/.test(line) || (i > 0 && /ca:allow-secret/.test(lines[i - 1]))) continue;
    for (const d of SECRET_RULES) {
      const m = line.match(d.re);
      if (!m) continue;
      const val = d.group ? m[d.group] : m[0];
      if (d.rule === "generic-secret" && SECRET_PLACEHOLDER.test(val)) continue;
      if (ignore.some((ig) => line.includes(ig) || val.includes(ig))) continue;
      findings.push({ file, line: i + 1, rule: d.rule, masked: maskSecret(val) });
    }
  }
}
function secretScan(args) {
  const f = flags(args);
  const dir = f.dir || ".";
  const ignore = loadSecretsIgnore(dir);
  const findings = [];
  let files = [];
  let mode;
  let truncated = 0;
  // Bounded mode (used by the 5s PreToolUse guard): cap the file count and give each
  // `git show` a timeout so a huge staged set can't blow the hook budget and make it
  // silently fail open. --no-tools skips the external gitleaks call for the same reason.
  const maxFiles = Number(f["max-files"] || 0);
  const noTools = !!f["no-tools"];
  if (f.staged) {
    mode = "staged";
    if (!inRepo(dir)) return { ok: false, reason: "not a git repository" };
    const r = sh("git", ["-C", dir, "diff", "--cached", "--name-only", "--diff-filter=ACM"]);
    files = r.stdout.split("\n").filter(Boolean);
    if (maxFiles > 0 && files.length > maxFiles) { truncated = files.length - maxFiles; files = files.slice(0, maxFiles); }
    for (const file of files) { const c = stagedContent(dir, file, maxFiles > 0 ? 3000 : 0); if (c != null) scanText(c, file, findings, ignore); }
  } else if (f.range) {
    mode = "range:" + f.range;
    const r = sh("git", ["-C", dir, "diff", "--name-only", "--diff-filter=ACM", String(f.range)]);
    files = r.stdout.split("\n").filter(Boolean);
    for (const file of files) { try { scanText(fs.readFileSync(path.join(dir, file), "utf8"), file, findings, ignore); } catch {} }
  } else {
    mode = "paths";
    files = f._.length ? f._ : [];
    if (!files.length) return { ok: false, reason: "usage: secret-scan --staged | --range <a..b> | <paths...>" };
    // In paths mode, also honor a .ca-secretsignore next to each scanned file.
    for (const file of files) {
      try {
        const perFile = ignore.concat(loadSecretsIgnore(path.dirname(path.resolve(file))));
        scanText(fs.readFileSync(file, "utf8"), path.basename(file), findings, perFile);
      } catch {}
    }
  }
  // Prefer gitleaks when present (best-effort merge; never fails the scan).
  let tool = "builtin";
  if (!noTools && have("gitleaks") && f.staged && inRepo(dir)) {
    const g = sh("gitleaks", ["protect", "--staged", "--source", dir, "--report-format", "json", "--report-path", "/dev/stdout", "--no-banner"], { timeout: 20000 });
    if (g.stdout) {
      try {
        for (const leak of JSON.parse(g.stdout)) {
          const file = leak.File || leak.file || "?";
          const ln = leak.StartLine || leak.line || 0;
          if (!findings.some((x) => x.file === file && x.line === ln)) {
            findings.push({ file, line: ln, rule: "gitleaks:" + (leak.RuleID || leak.rule || "match"), masked: maskSecret(String(leak.Secret || leak.match || "")) });
          }
        }
        tool = "builtin+gitleaks";
      } catch {}
    }
  }
  return { mode, tool, scanned: files.length, truncated, count: findings.length, findings };
}

function depsAudit(dir) {
  dir = dir || ".";
  const has = (p) => fs.existsSync(path.join(dir, p));
  const run = (manager, cmd, cmdArgs, parse) => {
    if (!have(cmd)) return { manager, available: false, hint: `install ${cmd} to audit ${manager} deps` };
    const r = sh(cmd, cmdArgs, { cwd: dir, timeout: 60000 });
    try { return { manager, available: true, ...parse(r) }; }
    catch (e) { return { manager, available: true, error: "parse failed: " + e.message, raw: (r.stdout || r.stderr || "").slice(0, 300) }; }
  };
  if (has("package-lock.json") || has("package.json")) {
    return run("npm", "npm", ["audit", "--json"], (r) => {
      const j = JSON.parse(r.stdout || "{}");
      const v = j.metadata && j.metadata.vulnerabilities || {};
      const advisories = Object.values(j.vulnerabilities || {}).map((a) => ({ pkg: a.name, severity: a.severity, id: (a.via && a.via[0] && a.via[0].url) || "", title: (a.via && a.via[0] && a.via[0].title) || "" }));
      return { counts: v, advisories: advisories.slice(0, 50) };
    });
  }
  if (has("Cargo.lock")) return run("cargo", "cargo", ["audit", "--json"], (r) => { const j = JSON.parse(r.stdout || "{}"); return { counts: j.vulnerabilities && j.vulnerabilities.count, advisories: [] }; });
  if (has("pyproject.toml") || has("requirements.txt")) return run("pip", "pip-audit", ["-f", "json"], (r) => ({ advisories: JSON.parse(r.stdout || "[]") }));
  if (has("go.mod")) return run("go", "govulncheck", ["-json", "./..."], () => ({ advisories: [], note: "see govulncheck output" }));
  return { manager: "unknown", available: false, hint: "no recognized dependency manifest in " + path.resolve(dir) };
}

function envCheck(dir) {
  dir = dir || ".";
  const keysOf = (file) => {
    try {
      return fs.readFileSync(path.join(dir, file), "utf8").split("\n")
        .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => l.split("=")[0].trim());
    } catch { return null; }
  };
  const actual = keysOf(".env");
  const example = keysOf(".env.example") || keysOf(".env.sample") || keysOf(".env.template");
  if (example === null) return { ok: false, reason: "no .env.example/.sample/.template found" };
  if (actual === null) return { has_env: false, example_keys: example.length, missing: example, extra: [], hint: "no .env — copy the example and fill it" };
  const aset = new Set(actual), eset = new Set(example);
  return { has_env: true, example_keys: example.length,
    missing: example.filter((k) => !aset.has(k)), extra: actual.filter((k) => !eset.has(k)) };
}

// ---------------------------------------------------------------------------
// git-hooks — install the SAME guardrails at the git layer so they hold outside
// a Claude Code session. Writes .githooks/{pre-commit,commit-msg} + core.hooksPath.
// ---------------------------------------------------------------------------
const GITHOOK_NAMES = ["pre-commit", "commit-msg"];
function githookTemplate(name) {
  return fs.readFileSync(path.join(__dirname, "..", "structure", "templates", "githooks", name), "utf8");
}
function installGitHooks(args) {
  const f = flags(args);
  const dir = f._[0] || f.dir || ".";
  const apply = !!f.apply;
  if (!inRepo(dir)) return { ok: false, reason: "not a git repository: " + path.resolve(dir) };
  const hooksRel = ".githooks";
  const hooksDir = path.join(dir, hooksRel);
  const currentPath = sh("git", ["-C", dir, "config", "--get", "core.hooksPath"]).stdout;
  const planned = [];
  for (const name of GITHOOK_NAMES) {
    const dest = path.join(hooksDir, name);
    let action = "create";
    if (fs.existsSync(dest)) action = githookTemplate(name) === safeRead(dest) ? "skip (current)" : "update";
    planned.push({ file: `${hooksRel}/${name}`, action });
  }
  planned.push({ config: "core.hooksPath", from: currentPath || "(unset)", to: hooksRel,
    action: currentPath === hooksRel ? "skip (current)" : "set" });
  if (!apply) return { dir: path.resolve(dir), apply: false, planned, hint: "re-run with --apply to write" };
  fs.mkdirSync(hooksDir, { recursive: true });
  for (const name of GITHOOK_NAMES) {
    const dest = path.join(hooksDir, name);
    fs.writeFileSync(dest, githookTemplate(name));
    fs.chmodSync(dest, 0o755);
  }
  sh("git", ["-C", dir, "config", "core.hooksPath", hooksRel]);
  return { dir: path.resolve(dir), apply: true, planned, hooksPath: hooksRel,
    note: "guardrails now run on every git commit (plain terminal too). CA_DISABLE=1 mutes; CA_GIT_GUARD_STRICT=1 blocks." };
}
function uninstallGitHooks(args) {
  const f = flags(args);
  const dir = f._[0] || f.dir || ".";
  if (!inRepo(dir)) return { ok: false, reason: "not a git repository: " + path.resolve(dir) };
  const had = sh("git", ["-C", dir, "config", "--get", "core.hooksPath"]).stdout;
  if (!f.apply) return { dir: path.resolve(dir), apply: false, would_unset: "core.hooksPath", current: had || "(unset)", hint: "re-run with --apply" };
  if (had === ".githooks") sh("git", ["-C", dir, "config", "--unset", "core.hooksPath"]);
  return { dir: path.resolve(dir), apply: true, unset: had === ".githooks", note: ".githooks/ files left in place; delete manually if unwanted." };
}
function safeRead(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }

// ---------------------------------------------------------------------------
// incident — scaffold a numbered blameless postmortem (mirrors ADR numbering);
// surface the latest release tag as the hotfix base.
// ---------------------------------------------------------------------------
function slugify(s) {
  return String(s || "incident").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "incident";
}
function incidentScaffold(args) {
  const f = flags(args);
  const dir = f.dir || ".";
  const title = f.title || f._.join(" ") || "untitled incident";
  const incDir = path.join(dir, "docs", "incidents");
  let max = 0;
  try {
    for (const fn of fs.readdirSync(incDir)) { const m = fn.match(/^(\d{4})-/); if (m) max = Math.max(max, Number(m[1])); }
  } catch {}
  const num = String(max + 1).padStart(4, "0");
  const slug = slugify(title);
  // Warn on a likely-duplicate: same slug already recorded under a different number.
  let dupe = null;
  try { dupe = fs.readdirSync(incDir).find((fn) => fn.replace(/^\d{4}-/, "") === `${slug}.md`); } catch {}
  if (dupe && !f.force) {
    return { ok: false, reason: `an incident with this topic already exists: docs/incidents/${dupe} — reuse it, or pass --force for a distinct record`, existing: `docs/incidents/${dupe}` };
  }
  const file = path.join(incDir, `${num}-${slug}.md`);
  const base = lastTag(dir) || "(no release tag yet)";
  const tmpl = githookSafeTemplate("incident-0000-template.md")
    .replace(/<NNNN>/g, num).replace(/<TITLE>/g, title).replace(/<BASE_TAG>/g, base);
  if (f.apply || f.write) {
    fs.mkdirSync(incDir, { recursive: true });
    if (fs.existsSync(file)) return { ok: false, reason: "already exists: " + file };
    fs.writeFileSync(file, tmpl);
    return { file: path.relative(dir, file), number: num, base_tag: base, written: true };
  }
  return { file: path.relative(dir, file), number: num, base_tag: base, written: false, hint: "re-run with --apply to write", preview: tmpl };
}
function githookSafeTemplate(name) {
  return fs.readFileSync(path.join(__dirname, "..", "structure", "templates", name), "utf8");
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
    case "review-prep":
      return reviewPrep(args.slice(1));
    default:
      return { ok: false, reason: "usage: graph <status|index|context|impact|detect-changes|query|review-prep> [args]" };
  }
}

// review-prep — deterministic blast-radius grounding for a code review. Computes
// the changed files, extracts candidate symbols from the diff, and (when gitnexus
// is present + indexed) measures each symbol's impact so severity can be grounded
// in evidence instead of gut feel. Degrades cleanly when gitnexus is absent.
// Read-only. Consumed by the code-review router / architectural-reviewer agent.
const SYMBOL_RULES = [
  { ext: /\.(js|jsx|ts|tsx|mjs|cjs)$/, res: [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g,
  ] },
  { ext: /\.py$/, res: [/^\s*def\s+([A-Za-z_]\w*)/gm, /^\s*class\s+([A-Za-z_]\w*)/gm] },
  { ext: /\.go$/, res: [/^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/gm, /^type\s+([A-Za-z_]\w*)\s/gm] },
  { ext: /\.(java|kt)$/, res: [/(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(/g, /class\s+([A-Za-z_]\w*)/g] },
  { ext: /\.(rs)$/, res: [/fn\s+([A-Za-z_]\w*)/g, /struct\s+([A-Za-z_]\w*)/g, /enum\s+([A-Za-z_]\w*)/g] },
];

function extractSymbols(content, file) {
  const rule = SYMBOL_RULES.find((r) => r.ext.test(file));
  if (!rule) return [];
  const out = new Set();
  for (const re of rule.res) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) if (m[1]) out.add(m[1]);
  }
  return [...out];
}

function changedFiles(dir) {
  // Prefer staged; fall back to the working-tree diff vs HEAD.
  const staged = sh("git", ["-C", dir, "diff", "--cached", "--name-only"]);
  let names = staged.status === 0 && staged.stdout ? staged.stdout : "";
  if (!names) {
    const wt = sh("git", ["-C", dir, "diff", "--name-only", "HEAD"]);
    names = wt.status === 0 ? wt.stdout : "";
  }
  return names.split("\n").map((s) => s.trim()).filter(Boolean);
}

// Best-effort parse of `gitnexus impact` output: pull an impacted count + risk.
function parseImpact(out) {
  const count = (out.match(/impacted[^0-9]*([0-9]+)/i) || out.match(/\b([0-9]+)\s+(?:depend|caller|impacted)/i) || [])[1];
  const risk = (out.match(/\brisk[:\s]+(critical|high|medium|low)\b/i) || out.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/) || [])[1];
  return { impactedCount: count !== undefined ? Number(count) : null, risk: risk ? risk.toUpperCase() : null };
}

function reviewPrep(args) {
  const f = flags(args);
  const dir = f._[0] || ".";
  if (!inRepo(dir)) return { ok: false, reason: "not a git repository" };
  const files = changedFiles(dir);
  const gnx = have("gitnexus");
  // Candidate symbols: explicit --symbols wins; else extract from changed files.
  let symbols = [];
  if (f.symbols) symbols = String(f.symbols).split(",").map((s) => s.trim()).filter(Boolean);
  else {
    for (const rel of files) {
      let body; try { body = fs.readFileSync(path.join(dir, rel), "utf8"); } catch { continue; }
      for (const s of extractSymbols(body, rel)) symbols.push(s);
    }
    symbols = [...new Set(symbols)].slice(0, 25);
  }
  if (!gnx) {
    return { ok: true, available: false, changedFiles: files, candidateSymbols: symbols,
      note: "GitNexus not installed — review severity is NOT blast-radius-grounded; assign severity by judgment and note that blast radius was not measured." };
  }
  // Measure blast radius per symbol (bounded; skips gracefully on per-symbol failure).
  const table = [];
  for (const sym of symbols.slice(0, 20)) {
    const r = sh("gitnexus", ["impact", sym], { cwd: dir, timeout: 1000 * 60 });
    if (r.status !== 0) continue;
    const { impactedCount, risk } = parseImpact(r.stdout);
    table.push({ symbol: sym, impactedCount, risk });
  }
  table.sort((a, b) => (b.impactedCount || 0) - (a.impactedCount || 0));
  return { ok: true, available: true, changedFiles: files, blastRadius: table,
    note: "Ground Severity/Priority in impactedCount + risk: a defect in a high-fan-in symbol is higher severity. Cite the count (e.g. 'impactedCount 65, risk HIGH')." };
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
function printUsage() {
  // Print the Usage block from this file's own header comment (single source of truth).
  const src = fs.readFileSync(__filename, "utf8");
  const m = src.match(/\*\s*Usage:[\s\S]*?(?=\n \*\/)/);
  process.stdout.write((m ? m[0].replace(/^ \* ?/gm, "").replace(/^\*/, "") : "ca-tools <command> — see header") + "\n");
}

async function main() {
  const f = flags(rest);
  switch (cmd) {
    case "help": case "--help": case "-h": return printUsage();
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
    case "secret-scan": {
      const res = secretScan(rest);
      if (flags(rest)["exit-code"]) {
        for (const x of (res.findings || [])) process.stderr.write(`  secret: ${x.rule} ${x.file}:${x.line} (${x.masked})\n`);
        process.exit((res.findings || []).length ? 1 : 0);
      }
      return out(res);
    }
    case "deps-audit": return out(depsAudit(flags(rest)._[0]));
    case "env-check": return out(envCheck(flags(rest)._[0]));
    case "install-git-hooks": return out(installGitHooks(rest));
    case "uninstall-git-hooks": return out(uninstallGitHooks(rest));
    case "incident-scaffold": return out(incidentScaffold(rest));
    case "github": return out(github(rest));
    case "track": return out(await track(rest));
    case "notify": return out(await notify(rest));
    case "scan": return out(await scan(rest));
    case "graph": return out(graph(rest));
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
    track, notify, flags, recall, secretScan, depsAudit, envCheck,
    installGitHooks, uninstallGitHooks, incidentScaffold,
    graph, reviewPrep, extractSymbols, changedFiles, parseImpact,
  };
}
