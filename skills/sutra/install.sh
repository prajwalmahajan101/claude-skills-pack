#!/usr/bin/env bash
# Install the sutra orchestrator skill: symlinks the SKILL.md tree + slash commands
# into ~/.claude/ and merges its SessionStart hook. Idempotent.
#
# sutra is optional glue. It drives the pack's members (code_assist, sb, unabridged)
# but does not require them — install whichever members you want; sutra bridges the
# ones that are present.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SKILL_NAME="sutra"
SKILL_LINK="$CLAUDE_DIR/skills/$SKILL_NAME"
COMMANDS_DIR="$CLAUDE_DIR/commands/$SKILL_NAME"
SETTINGS="$CLAUDE_DIR/settings.json"

say()  { printf "\033[1;34m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33mWARN:\033[0m %s\n" "$*"; }

mkdir -p "$CLAUDE_DIR/skills" "$COMMANDS_DIR"

say "Linking skill → $SKILL_LINK"
ln -sfn "$HERE" "$SKILL_LINK"

if compgen -G "$HERE/commands/"'*.md' > /dev/null; then
  say "Linking slash commands → $COMMANDS_DIR"
  for f in "$HERE/commands/"*.md; do
    ln -sfn "$f" "$COMMANDS_DIR/$(basename "$f")"
  done
fi

# ─── hook → settings.json merge (SessionStart) ───────────────────────────────
# Idempotent: strip any prior sutra hook entry, then append fresh. Honors SUTRA_DISABLE=1.
if command -v jq >/dev/null 2>&1; then
  say "Merging sutra hook into $SETTINGS"
  mkdir -p "$(dirname "$SETTINGS")"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"

  TMP_SNIPPET=$(mktemp)
  CLAUDE_DIR_ESC=$(printf '%s' "$CLAUDE_DIR" | sed 's:[\/&]:\\&:g')
  sed "s:\\\$CLAUDE_DIR:$CLAUDE_DIR_ESC:g" "$HERE/settings-snippet.json" > "$TMP_SNIPPET"

  jq --slurpfile snip "$TMP_SNIPPET" '
    def strip_sutra: map(.hooks |= map(select(.command // "" | test("sutra-session-start\\.js") | not)) | select(.hooks | length > 0));
    .hooks = (.hooks // {}) |
    .hooks |= with_entries(.value |= strip_sutra) |
    reduce ($snip[0].hooks | keys[]) as $k (.;
      .hooks[$k] = ((.hooks[$k] // []) + ($snip[0].hooks[$k]))
    ) |
    .hooks |= with_entries(select(.value | length > 0))
  ' "$SETTINGS" > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"
  rm -f "$TMP_SNIPPET"
  say "Hook merged. Backup at $SETTINGS.bak.*  (disable with SUTRA_DISABLE=1)"
else
  warn "jq not found — skipped hook merge. Manually merge $HERE/settings-snippet.json into $SETTINGS under 'hooks'."
fi

echo
say "sutra installed."
CMD_COUNT=$(ls "$COMMANDS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  Skill:    $SKILL_LINK"
echo "  Hook:     sutra-session-start (SessionStart)"
echo "  Commands: $CMD_COUNT unified /sutra:<name> commands"
echo "  Members:  $(node "$HERE/bin/sutra-tools.js" registry 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log((JSON.parse(s).present||[]).join(", ")||"none present")}catch{console.log("(run: sutra-tools registry)")}})')"
