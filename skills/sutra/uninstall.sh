#!/usr/bin/env bash
# Uninstall the sutra skill — removes symlinks + its hook entry, never deletes source files.
# Removing sutra leaves every member fully functional standalone.
set -euo pipefail
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SKILL_NAME="sutra"
SETTINGS="$CLAUDE_DIR/settings.json"

rm -f "$CLAUDE_DIR/skills/$SKILL_NAME"
rm -rf "$CLAUDE_DIR/commands/$SKILL_NAME"

# Strip sutra hook entry from settings.json (idempotent; same matcher as install).
if command -v jq >/dev/null 2>&1 && [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
  jq '
    def strip_sutra: map(.hooks |= map(select(.command // "" | test("sutra-session-start\\.js") | not)) | select(.hooks | length > 0));
    if .hooks then .hooks |= (with_entries(.value |= strip_sutra) | with_entries(select(.value | length > 0))) else . end
  ' "$SETTINGS" > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"
fi

echo "sutra uninstalled. Source files in $(dirname "$(readlink -f "$0")") untouched. Members remain standalone."
