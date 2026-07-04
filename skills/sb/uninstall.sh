#!/usr/bin/env bash
# Uninstall the sb skill. Leaves vault contents untouched.

set -euo pipefail
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"

echo "Removing skill files…"
rm -rf "$CLAUDE_DIR/skills/sb"
rm -rf "$CLAUDE_DIR/commands/sb"
rm -f  "$CLAUDE_DIR/hooks/sb-capture.js"
rm -f  "$CLAUDE_DIR/hooks/sb-plan-mirror.js"
rm -f  "$CLAUDE_DIR/hooks/sb-session-start.js"
rm -f  "$CLAUDE_DIR/hooks/sb-session-end.js"
rm -f  "$CLAUDE_DIR/hooks/sb-prompt-watch.js"
rm -f  "$CLAUDE_DIR/hooks/sb-validate.js"

if command -v jq >/dev/null && [ -f "$CLAUDE_DIR/settings.json" ]; then
  echo "Stripping sb hook entries from settings.json…"
  cp "$CLAUDE_DIR/settings.json" "$CLAUDE_DIR/settings.json.bak.$(date +%s)"
  jq '
    .hooks |= (
      to_entries |
      map(.value |= map(.hooks |= map(select(.command | test("sb-(capture|plan-mirror|session-start|session-end|prompt-watch|validate)\\.js") | not)) | select(.hooks | length > 0))) |
      map(select(.value | length > 0)) |
      from_entries
    )
  ' "$CLAUDE_DIR/settings.json" > "$CLAUDE_DIR/settings.json.new" && mv "$CLAUDE_DIR/settings.json.new" "$CLAUDE_DIR/settings.json"
else
  echo "WARN: install jq, or manually strip sb hook entries from $CLAUDE_DIR/settings.json"
fi

echo "Done. Vault left untouched: ${SB_VAULT_PATH:-$HOME/Documents/vaults/ai-mind}"
