#!/usr/bin/env bash
# Uninstall the code_assist skill — removes symlinks + hook entries, never deletes source files.
set -euo pipefail
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SKILL_NAME="code_assist"
SETTINGS="$CLAUDE_DIR/settings.json"

rm -f "$CLAUDE_DIR/skills/$SKILL_NAME"
rm -rf "$CLAUDE_DIR/commands/$SKILL_NAME"
for agent in architectural-reviewer commit-planner journal-writer \
             ca-planner ca-debugger ca-verifier ca-structure-auditor; do
  rm -f "$CLAUDE_DIR/agents/$agent.md"
done

# Strip code_assist hook entries from settings.json (idempotent; same matcher as install).
if command -v jq >/dev/null 2>&1 && [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
  jq '
    def strip_ca: map(.hooks |= map(select(.command // "" | test("ca-(session-start|git-guard)\\.js") | not)) | select(.hooks | length > 0));
    if .hooks then .hooks |= (with_entries(.value |= strip_ca) | with_entries(select(.value | length > 0))) else . end
  ' "$SETTINGS" > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"
fi

echo "code_assist uninstalled. Source files in $(dirname "$(readlink -f "$0")") untouched."
