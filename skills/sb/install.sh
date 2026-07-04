#!/usr/bin/env bash
# Install the sb (second-brain) skill into the current user's Claude Code config.
# Idempotent: re-running updates files in place without destroying state.

set -euo pipefail

# ─── config ─────────────────────────────────────────────────────────────────
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
VAULT_PATH="${SB_VAULT_PATH:-$HOME/Documents/vaults/ai-mind}"
SKILL_DIR="$CLAUDE_DIR/skills/sb"
HOOKS_DIR="$CLAUDE_DIR/hooks"
COMMANDS_DIR="$CLAUDE_DIR/commands/sb"
SETTINGS="$CLAUDE_DIR/settings.json"

say() { printf "\033[1;34m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33mWARN:\033[0m %s\n" "$*"; }
die() { printf "\033[1;31mERR:\033[0m %s\n" "$*" >&2; exit 1; }

# ─── prereq checks ──────────────────────────────────────────────────────────
say "Checking prerequisites…"
command -v node >/dev/null || die "node not found. Install Node.js ≥ 18."
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
[ "$NODE_MAJOR" -ge 18 ] || die "Node $NODE_MAJOR is too old; need ≥ 18."

if ! command -v jq >/dev/null; then
  warn "jq not found — settings.json merge will be skipped. Install jq for auto-merge."
  HAVE_JQ=0
else
  HAVE_JQ=1
fi

command -v claude >/dev/null || warn "claude CLI not on PATH — /sb:analyze and /sb:lesson will fail until you fix that or set SB_CLAUDE_BIN."

if ! command -v obsidian >/dev/null; then
  warn "obsidian CLI not on PATH — /sb:search and /sb:kanban --open will fail. See README Prerequisites."
fi

# ─── 1. skill files ─────────────────────────────────────────────────────────
say "Installing skill files → $SKILL_DIR"
mkdir -p "$SKILL_DIR/lib" "$SKILL_DIR/commands/_runners" "$SKILL_DIR/prompts" "$SKILL_DIR/bin"
cp "$HERE/SKILL.md" "$SKILL_DIR/SKILL.md"
cp "$HERE/lib/"*.js "$SKILL_DIR/lib/"
cp "$HERE/commands/"*.md "$SKILL_DIR/commands/"
cp "$HERE/commands/_runners/"*.js "$SKILL_DIR/commands/_runners/"
chmod +x "$SKILL_DIR/commands/_runners/"*.js
if [ -d "$HERE/bin" ]; then
  cp "$HERE/bin/"*.js "$SKILL_DIR/bin/" 2>/dev/null || true
  chmod +x "$SKILL_DIR/bin/"*.js 2>/dev/null || true
fi

# Plugin manifest (version only) — so the installed skill reports its version
# (sutra's registry reads .claude-plugin/plugin.json). We deliberately do NOT install
# hooks/hooks.json here: this installer registers hooks via settings.json (step 5, the
# single method), and the skill dir loads as a @skills-dir plugin whose manifest would
# auto-register the SAME hooks a second time — a double-registration, and since the
# sb-*.js scripts live in the flat ~/.claude/hooks (not the skill dir), the manifest's
# ${CLAUDE_PLUGIN_ROOT}/hooks/*.js paths would not resolve → MODULE_NOT_FOUND. The
# manifest stays in the repo for the /plugin install path, where scripts are colocated.
mkdir -p "$SKILL_DIR/.claude-plugin"
cp "$HERE/.claude-plugin/plugin.json" "$SKILL_DIR/.claude-plugin/plugin.json"
# Self-heal prior installs that copied the manifest into the skill dir (the crash source).
rm -f "$SKILL_DIR/hooks/hooks.json"
rmdir "$SKILL_DIR/hooks" 2>/dev/null || true

# ─── 2. hooks ───────────────────────────────────────────────────────────────
say "Installing hooks → $HOOKS_DIR"
mkdir -p "$HOOKS_DIR"
cp "$HERE/hooks/"*.js "$HOOKS_DIR/"
chmod +x "$HOOKS_DIR/sb-"*.js

# ─── 3. command symlinks ────────────────────────────────────────────────────
say "Linking slash commands → $COMMANDS_DIR"
mkdir -p "$COMMANDS_DIR"
for f in "$SKILL_DIR/commands/"*.md; do
  base=$(basename "$f")
  ln -sf "$f" "$COMMANDS_DIR/$base"
done

# ─── 4. vault scaffold (Phase 9: numbered layout, mirrors my_vault) ─────────
say "Scaffolding vault → $VAULT_PATH"
mkdir -p "$VAULT_PATH"/{00_Dashboard,01_Conversations,02_Projects,03_Lessons,04_Topics,05_Tasks,06_Connections,07_Reviews/Daily,07_Reviews/Weekly,08_Insights,09_Exports,10_Memory,11_Decisions,12_People,13_Meetings,14_Zettelkasten,15_Habits,16_Ideas,99_Inbox,_templates,_assets,__scribble,_meta}
cp -n "$HERE/vault-templates/"*.md "$VAULT_PATH/_templates/" 2>/dev/null || true
[ -f "$VAULT_PATH/_meta/session-map.json"     ] || echo '{}' > "$VAULT_PATH/_meta/session-map.json"
[ -f "$VAULT_PATH/_meta/tag-rules.json"       ] || cp "$HERE/tag-rules.seed.json" "$VAULT_PATH/_meta/tag-rules.json"
[ -f "$VAULT_PATH/_meta/tag-aliases.json"     ] || cp "$HERE/tag-aliases.seed.json" "$VAULT_PATH/_meta/tag-aliases.json"
[ -f "$VAULT_PATH/_meta/project-aliases.json" ] || echo '{}' > "$VAULT_PATH/_meta/project-aliases.json"

# Seed Home.md (homepage-plugin target) and Tasks INDEX from templates if missing.
if [ ! -f "$VAULT_PATH/00_Dashboard/Home.md" ] && [ -f "$HERE/vault-templates/home.md" ]; then
  cp "$HERE/vault-templates/home.md" "$VAULT_PATH/00_Dashboard/Home.md"
fi
if [ ! -f "$VAULT_PATH/05_Tasks/INDEX.md" ]; then
  cat > "$VAULT_PATH/05_Tasks/INDEX.md" <<'EOF'
---
type: tasks-index
tags: [dashboard, tasks]
---

# Tasks (all projects)

## Doing
```dataview
TASK FROM "02_Projects" WHERE !completed AND contains(string(status), "doing")
```

## To Do
```dataview
TASK FROM "02_Projects" WHERE !completed
```

## Recently Done
```dataview
TASK FROM "02_Projects" WHERE completed AND completion >= date(today) - dur(7 days)
```
EOF
fi

# ─── 4b. theming + plugins (mirror my_vault) ────────────────────────────────
say "Seeding Obsidian theme + plugins → $VAULT_PATH/.obsidian"
MY_VAULT_OBS="${SB_REF_VAULT:-$HOME/Documents/vaults/my_vault}/.obsidian"
mkdir -p "$VAULT_PATH/.obsidian/themes" "$VAULT_PATH/.obsidian/plugins" "$VAULT_PATH/.obsidian/snippets"

# Themes
for theme in Encore Omarchy; do
  if [ ! -d "$VAULT_PATH/.obsidian/themes/$theme" ]; then
    if [ -d "$MY_VAULT_OBS/themes/$theme" ]; then
      cp -r "$MY_VAULT_OBS/themes/$theme" "$VAULT_PATH/.obsidian/themes/"
    else
      warn "Theme '$theme' not found at $MY_VAULT_OBS/themes/$theme — install via Obsidian → Settings → Appearance → Manage."
    fi
  fi
done

# Plugins (mirror from my_vault; preserves any already in target)
if [ -d "$MY_VAULT_OBS/plugins" ]; then
  copied=0; skipped=0
  for plug in "$MY_VAULT_OBS/plugins/"*/; do
    pname=$(basename "$plug")
    if [ -d "$VAULT_PATH/.obsidian/plugins/$pname" ]; then
      skipped=$((skipped + 1))
    else
      cp -r "$plug" "$VAULT_PATH/.obsidian/plugins/"
      copied=$((copied + 1))
    fi
  done
  say "Plugins: $copied copied, $skipped preserved."
else
  warn "No plugins source at $MY_VAULT_OBS/plugins — install community plugins manually."
fi

# community-plugins.json (enable list) — only seed if missing or empty
CP="$VAULT_PATH/.obsidian/community-plugins.json"
if [ ! -s "$CP" ] && [ -f "$MY_VAULT_OBS/community-plugins.json" ]; then
  cp "$MY_VAULT_OBS/community-plugins.json" "$CP"
  say "Seeded community-plugins.json from my_vault."
fi

# core-plugins.json — only seed if missing
COREP="$VAULT_PATH/.obsidian/core-plugins.json"
if [ ! -s "$COREP" ] && [ -f "$MY_VAULT_OBS/core-plugins.json" ]; then
  cp "$MY_VAULT_OBS/core-plugins.json" "$COREP"
fi

# appearance.json
APPEARANCE="$VAULT_PATH/.obsidian/appearance.json"
if [ ! -f "$APPEARANCE" ] || [ "$(tr -d '[:space:]' < "$APPEARANCE")" = "{}" ] || [ ! -s "$APPEARANCE" ]; then
  cat > "$APPEARANCE" <<'EOF'
{
  "accentColor": "#93b1a6",
  "cssTheme": "Encore",
  "theme": "obsidian"
}
EOF
else
  say "Preserved existing appearance.json (not overwriting user customizations)."
fi

# ─── 5. settings.json merge ─────────────────────────────────────────────────
if [ "$HAVE_JQ" -eq 1 ]; then
  say "Merging hook registration into $SETTINGS"
  mkdir -p "$(dirname "$SETTINGS")"
  if [ ! -f "$SETTINGS" ]; then echo '{}' > "$SETTINGS"; fi
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"

  # Expand $HOME in the snippet before merging
  TMP_SNIPPET=$(mktemp)
  HOME_ESC=$(printf '%s' "$HOME" | sed 's:[\/&]:\\&:g')
  sed "s:\\\$HOME:$HOME_ESC:g" "$HERE/settings-snippet.json" > "$TMP_SNIPPET"

  # Merge idempotently: strip any existing sb-* hook entries first, then append fresh ones.
  # An "sb-* entry" = an entry whose .hooks[] contains a command matching sb-(capture|session-start|session-end|plan-mirror|prompt-watch).js
  jq --slurpfile snip "$TMP_SNIPPET" '
    def strip_sb: map(.hooks |= map(select(.command // "" | test("sb-(capture|session-start|session-end|plan-mirror|prompt-watch|validate)\\.js") | not)) | select(.hooks | length > 0));
    .hooks = (.hooks // {}) |
    .hooks |= with_entries(.value |= strip_sb) |
    reduce ($snip[0].hooks | keys[]) as $k (.;
      .hooks[$k] = ((.hooks[$k] // []) + ($snip[0].hooks[$k]))
    ) |
    .hooks |= with_entries(select(.value | length > 0))
  ' "$SETTINGS" > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"
  rm -f "$TMP_SNIPPET"
  say "Settings merged. Backup at $SETTINGS.bak.*"
else
  warn "Skipped settings.json merge. Manually merge $HERE/settings-snippet.json into $SETTINGS under 'hooks'."
fi

# ─── done ───────────────────────────────────────────────────────────────────
echo
say "Install complete."
echo "  Skill:    $SKILL_DIR"
echo "  Hooks:    $HOOKS_DIR/sb-*.js"
echo "  Commands: $COMMANDS_DIR"
echo "  Vault:    $VAULT_PATH"
echo
echo "Smoke test:"
echo "  cd ~/tmp/sb-smoketest 2>/dev/null || mkdir -p ~/tmp/sb-smoketest && cd ~/tmp/sb-smoketest"
echo "  claude     # have a 2-turn convo, exit"
echo "  ls $VAULT_PATH/conversations/"
echo
echo "Then: /sb:status"
