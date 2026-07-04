#!/usr/bin/env bash
# Install the code_assist skill: symlinks SKILL.md tree, agents, and slash commands
# into ~/.claude/. Idempotent.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SKILL_NAME="code_assist"
SKILL_LINK="$CLAUDE_DIR/skills/$SKILL_NAME"
AGENTS_DIR="$CLAUDE_DIR/agents"
COMMANDS_DIR="$CLAUDE_DIR/commands/$SKILL_NAME"
SETTINGS="$CLAUDE_DIR/settings.json"

say()  { printf "\033[1;34m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33mWARN:\033[0m %s\n" "$*"; }

mkdir -p "$CLAUDE_DIR/skills" "$AGENTS_DIR" "$COMMANDS_DIR"

say "Linking skill → $SKILL_LINK"
ln -sfn "$HERE" "$SKILL_LINK"

say "Linking agents → $AGENTS_DIR"
for f in "$HERE/agents/"*.md; do
  ln -sfn "$f" "$AGENTS_DIR/$(basename "$f")"
done

say "Linking slash commands → $COMMANDS_DIR"
for f in "$HERE/commands/"*.md; do
  ln -sfn "$f" "$COMMANDS_DIR/$(basename "$f")"
done

# ─── hooks → settings.json merge (SessionStart + PreToolUse git-guard) ────────
# Idempotent: strip any prior code_assist hook entries, then append fresh ones.
# Hooks run from the symlinked skill dir; both honor CA_DISABLE=1.
if command -v jq >/dev/null 2>&1; then
  say "Merging code_assist hooks into $SETTINGS"
  mkdir -p "$(dirname "$SETTINGS")"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"

  TMP_SNIPPET=$(mktemp)
  HOME_ESC=$(printf '%s' "$HOME" | sed 's:[\/&]:\\&:g')
  sed "s:\\\$HOME:$HOME_ESC:g" "$HERE/settings-snippet.json" > "$TMP_SNIPPET"

  # A "code_assist entry" = one whose .hooks[] command matches ca-(session-start|git-guard).js
  jq --slurpfile snip "$TMP_SNIPPET" '
    def strip_ca: map(.hooks |= map(select(.command // "" | test("ca-(session-start|git-guard)\\.js") | not)) | select(.hooks | length > 0));
    .hooks = (.hooks // {}) |
    .hooks |= with_entries(.value |= strip_ca) |
    reduce ($snip[0].hooks | keys[]) as $k (.;
      .hooks[$k] = ((.hooks[$k] // []) + ($snip[0].hooks[$k]))
    ) |
    .hooks |= with_entries(select(.value | length > 0))
  ' "$SETTINGS" > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"
  rm -f "$TMP_SNIPPET"
  say "Hooks merged. Backup at $SETTINGS.bak.*  (disable with CA_DISABLE=1; strict git-guard with CA_GIT_GUARD_STRICT=1)"
else
  warn "jq not found — skipped hook merge. Manually merge $HERE/settings-snippet.json into $SETTINGS under 'hooks'."
fi

echo
say "code_assist installed."
CMD_COUNT=$(ls "$COMMANDS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
AGENT_COUNT=$(ls "$HERE/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  Skill:    $SKILL_LINK"
echo "  Agents:   $AGENT_COUNT — architectural-reviewer, commit-planner, journal-writer,"
echo "            ca-planner, ca-debugger, ca-verifier, ca-structure-auditor"
echo "  Hooks:    ca-session-start (SessionStart), ca-git-guard (PreToolUse:Bash)"
echo "  Commands: $CMD_COUNT slash commands across families —"
echo "            commit, code_review, journal, plan, debug, adr, verify, structure,"
echo "            format, github, track, notify, scan, graph, onboard, test, refactor,"
echo "            release, domains, flow (run /code_assist:<name>)."
