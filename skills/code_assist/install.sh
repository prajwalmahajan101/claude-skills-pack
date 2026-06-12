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

say() { printf "\033[1;34m==>\033[0m %s\n" "$*"; }

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

echo
say "code_assist installed."
echo "  Skill:    $SKILL_LINK"
echo "  Agents:   architectural-reviewer, commit-planner, journal-writer"
echo "  Commands: /code_assist:code_review[_backend|_frontend|_tui], /code_assist:git_commit[_plan], /code_assist:journal"
