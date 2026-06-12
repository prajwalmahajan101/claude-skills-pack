#!/usr/bin/env bash
# unabridged-postwrite.sh — PostToolUse hook for Write/Edit.
# Reads the Claude Code hook JSON envelope from stdin, extracts the target file path,
# and runs check_placeholders.sh against it. On hits, prints a blocking error so
# Claude sees and fixes the violation before continuing.
#
# Hook contract (Claude Code PostToolUse): stdin is JSON. Typical shape:
# { "tool_name": "Write" | "Edit" | ..., "tool_input": { "file_path": "/abs/path" }, ... }
#
# Exit codes:
#   0  — no violations (or non-applicable tool / path).
#   2  — violations found; stderr is shown back to Claude as a blocking message.

set -u

CHECKER="$HOME/.claude/skills/unabridged/scripts/check_placeholders.sh"

# If the checker is missing (skill removed/renamed), be silent and let the write through.
[ -x "$CHECKER" ] || exit 0

# Read stdin envelope. Tolerate missing jq by falling back to a sed-based extractor.
input=$(cat)

extract_field() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r --arg k "$key" '
      .tool_input[$k]
      // .params[$k]
      // (if .tool_input.edits then (.tool_input.edits[0][$k] // empty) else empty end)
      // empty
    ' 2>/dev/null
  else
    printf '%s' "$input" \
      | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
      | head -n1
  fi
}

tool_name=$(
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r '.tool_name // .tool // empty' 2>/dev/null
  else
    printf '%s' "$input" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1
  fi
)

case "$tool_name" in
  Write|Edit|NotebookEdit|MultiEdit) ;;
  "") ;; # tolerate missing field — still try to extract a file_path
  *) exit 0 ;;
esac

file_path=$(extract_field "file_path")
[ -n "$file_path" ] || file_path=$(extract_field "path")
[ -n "$file_path" ] || exit 0

# Only enforce on code files. Markdown/text are still allowed to have "TODO" etc.
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.go|*.rs|*.java|*.kt|*.rb|*.php|*.c|*.h|*.cc|*.cpp|*.hpp|*.cs|*.swift|*.scala|*.sh|*.bash|*.zsh) ;;
  *) exit 0 ;;
esac

if ! "$CHECKER" "$file_path"; then
  cat >&2 <<EOF

unabridged hook: the file you just wrote contains banned placeholder patterns.
See ~/.claude/skills/unabridged/code/SKILL.md for the rules.
Fix the file and re-run, or invoke ~/.claude/skills/unabridged/scripts/check_placeholders.sh
manually to confirm a clean pass.
EOF
  exit 2
fi

exit 0
