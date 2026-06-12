#!/usr/bin/env bash
# Uninstall the code_assist skill — removes symlinks only, never deletes source files.
set -euo pipefail
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SKILL_NAME="code_assist"

rm -f "$CLAUDE_DIR/skills/$SKILL_NAME"
rm -rf "$CLAUDE_DIR/commands/$SKILL_NAME"
for agent in architectural-reviewer commit-planner journal-writer; do
  rm -f "$CLAUDE_DIR/agents/$agent.md"
done

echo "code_assist uninstalled. Source files in $(dirname "$(readlink -f "$0")") untouched."
