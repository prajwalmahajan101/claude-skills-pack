# Known Issues

Tracked defects surfaced by the fresh-eyes audit that are **not yet fixed**. Each entry is
`file:line` evidence, impact, and a suggested fix. Remove an entry when its fix lands (with a
regression test). Severity: **H** = High, **M** = Medium, **L** = Low; `(test-gap)` marks a
missing-coverage risk rather than a live bug.

H1–H4 (the original divergent issue parsers, unlocked frontmatter write, and untested vault-repair)
were fixed for the v1.0.0 release, along with the audit follow-ups F1–F5 (sutra fence/metadata
hardening), the sb lock-bypass observability + collision-proof temp, and N1 (sb plugin-manifest
hooks). The items below are the remaining lower-severity findings, tracked for a follow-up.

## Open

### M1 — pack: code_assist/sutra double-fire hooks (symlink install ships the manifest too)

- **Where:** `skills/code_assist/install.sh` + `skills/sutra/install.sh` (`ln -sfn "$HERE"` symlink of
  the whole skill dir) vs their `hooks/hooks.json`, plus the `settings-snippet.json` merge each runs.
- **Issue:** `code_assist` and `sutra` **symlink** their entire skill dir into `~/.claude/skills/`, so
  the plugin manifest `hooks/hooks.json` is *always* present and auto-registers (loaded as
  `@skills-dir` plugins) — **and** each `install.sh` also merges the same hooks into
  `~/.claude/settings.json`. Both registrations point at existing colocated scripts, so there is no
  crash, but the hooks **fire twice** from `install.sh` alone (e.g. `ca-git-guard` runs twice per Bash
  call; `sutra-session-start` twice). Unlike the sb crash, this needs no "ran both methods" mistake —
  the symlink install self-double-registers. The `strip_*` idempotency only dedupes within
  settings.json; it is blind to the manifest.
- **Not affected:** `sb` — fixed in #10; its `install.sh` copies files (no manifest) and registers via
  `settings.json` only. `unabridged` ships no `hooks/hooks.json`.
- **Fix:** pick one canonical mechanism per install method. Either have `code_assist`/`sutra`
  `install.sh` **skip the settings.json merge** (rely on the symlinked manifest, the plugin path), or
  stop shipping the manifest to the symlink target and keep settings.json — mirroring the sb #10 fix.
  Whichever is chosen, apply it consistently so a single install can't register a hook twice.

### L1 — sb: per-file lock never reaches its own stale-reclaim window

- **Where:** `skills/sb/lib/markdown.js` `withFileLock` and `skills/sb/lib/vault.js`
  `updateSessionMap` (same pattern in both)
- **Issue:** the acquisition loop waits 50 × 20ms = 1s total, but a stale lock is only reclaimed
  after 10s — so a crashed holder's lockfile is never reclaimed by this path, and every subsequent
  writer gives up at 1s and proceeds unlocked (now observable via `logDiag`, but permanent until the
  orphaned lock is removed by hand). Not a live clobber in the common case; degrades to the
  pre-lock behavior under a crashed holder.
- **Fix:** reconcile the acquisition budget with the stale threshold (e.g. reclaim a lock older than
  a bound the 1s loop can actually reach, without false-reclaiming a live sub-second holder). Apply
  to both lock sites so they stay symmetric.

### L2 — sutra: per-file artifact reads swallow errors silently

- **Where:** `skills/sutra/lib/artifacts.js` `readJournals`/`readReviews`/`readAdrs` (empty
  `catch {}` around each `fs.readFileSync`)
- **Issue:** a permission-denied (or otherwise unreadable) `.md` file is silently omitted from the
  result set, so `schema-check` can report a truncated view as conforming and `sync-artifacts` can
  build an incomplete vault payload with no signal. The top-level git `repoRoot` fallback is a
  legitimate no-repo case, but per-file read failures on known artifacts are not.
- **Fix:** collect per-file read errors and surface them (e.g. a `readErrors` field / schema-check
  warnings) instead of dropping the file.

### L4 — sb: optional lesson-miner is install.sh-only (no `/plugin` parity)

- **Where:** `skills/sb/hooks/lesson-miner-trigger.js:20` (worker resolved at
  `~/.claude/hooks/lesson-miner.js`), absent from both `hooks/hooks.json` and `settings-snippet.json`
- **Issue:** the optional auto lesson-mining hook (README: sb hooks are "6 + 2 (opt)") is not wired
  in either default auto-install manifest, and its trigger hard-codes the `$HOME/.claude/hooks`
  worker path — so it can only run on the symlink-install path, never via `/plugin install`. This is
  intended-optional, not a live capture bug, but the two install paths are not at feature parity.
- **Fix:** if the miner should be reachable on the plugin path, resolve the worker via
  `${CLAUDE_PLUGIN_ROOT}` and add an opt-in SessionStart entry; otherwise scope the README claim to
  the symlink installer.

### L3 (test-gap) — no test for the unlocked lock-bypass path

- **Where:** `skills/sb/lib/markdown.js` `withFileLock` fallback + `skills/sb/tests/markdown.test.js`
- **Issue:** the observability `logDiag` on lock-acquisition failure is not exercised by a test
  (it needs a genuinely-held lock to trigger). The happy-path lock (no leftover `.lock`/`.tmp`) is
  covered; the give-up branch is not.
- **Fix:** a test that pre-creates `<file>.lock`, calls `updateFrontmatter`, and asserts the write
  still lands (best-effort) and a diagnostic is logged.
