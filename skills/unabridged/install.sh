#!/usr/bin/env bash
# Install the unabridged skill:
#  1. symlink skill body into ~/.claude/skills/unabridged
#  2. copy unabridged-postwrite.sh into ~/.claude/hooks/
#  3. merge PostToolUse hook entry into ~/.claude/settings.json (idempotent)
# No slash commands, no agents.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SKILL_NAME="unabridged"
SKILL_LINK="$CLAUDE_DIR/skills/$SKILL_NAME"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"

say()  { printf "\033[1;34m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33mWARN:\033[0m %s\n" "$*"; }

mkdir -p "$CLAUDE_DIR/skills" "$HOOKS_DIR"

say "Linking skill → $SKILL_LINK"
ln -sfn "$HERE" "$SKILL_LINK"
chmod +x "$HERE/scripts/check_placeholders.sh" 2>/dev/null || true

say "Installing PostToolUse hook → $HOOKS_DIR/unabridged-postwrite.sh"
cp "$HERE/hooks/unabridged-postwrite.sh" "$HOOKS_DIR/unabridged-postwrite.sh"
chmod +x "$HOOKS_DIR/unabridged-postwrite.sh"

if command -v jq >/dev/null; then
  say "Merging hook entry into $SETTINGS"
  mkdir -p "$(dirname "$SETTINGS")"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"

  TMP_SNIPPET=$(mktemp)
  HOME_ESC=$(printf '%s' "$HOME" | sed 's:[\/&]:\\&:g')
  sed "s:\\\$HOME:$HOME_ESC:g" "$HERE/settings-snippet.json" > "$TMP_SNIPPET"

  jq --slurpfile snip "$TMP_SNIPPET" '
    def strip_unabridged: map(.hooks |= map(select(.command // "" | test("unabridged-postwrite\\.sh") | not)) | select(.hooks | length > 0));
    .hooks = (.hooks // {}) |
    .hooks |= with_entries(.value |= strip_unabridged) |
    reduce ($snip[0].hooks | keys[]) as $k (.;
      .hooks[$k] = ((.hooks[$k] // []) + ($snip[0].hooks[$k]))
    ) |
    .hooks |= with_entries(select(.value | length > 0))
  ' "$SETTINGS" > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"
  rm -f "$TMP_SNIPPET"
else
  warn "jq not found — manually merge $HERE/settings-snippet.json into $SETTINGS under 'hooks'."
fi

echo
say "unabridged installed."
echo "  Skill:    $SKILL_LINK"
echo "  Hook:     $HOOKS_DIR/unabridged-postwrite.sh (PostToolUse on Write|Edit)"
echo "  Trigger:  context skill — fires on phrases like 'full file', 'no placeholders', 'unabridged', etc."
