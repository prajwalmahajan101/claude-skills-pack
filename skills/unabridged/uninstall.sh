#!/usr/bin/env bash
set -euo pipefail
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"

rm -f "$CLAUDE_DIR/skills/unabridged"
rm -f "$CLAUDE_DIR/hooks/unabridged-postwrite.sh"

if command -v jq >/dev/null && [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
  jq '
    .hooks |= (
      to_entries |
      map(.value |= map(.hooks |= map(select(.command | test("unabridged-postwrite\\.sh") | not)) | select(.hooks | length > 0))) |
      map(select(.value | length > 0)) |
      from_entries
    )
  ' "$SETTINGS" > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"
fi

echo "unabridged uninstalled."
