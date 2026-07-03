#!/usr/bin/env bash
# dev-sync.sh — reverse mirror: installed copy → source repo.
#
# The installed skill lives at ~/.claude/skills/sb (+ hooks at ~/.claude/hooks/sb-*.js)
# and is the working copy you actually edit and test. This repo (skills/sb/) is the
# canonical source / mirror target. install.sh goes repo → installed; this goes the
# other way, so edits made in place can be committed.
#
# Mirror is ADDITIVE/OVERWRITE only — it never deletes files in the repo (the repo
# carries docs/, prompts/, vault-templates/, bin/, seeds, install.sh, README.md that
# the installed copy does not have). It copies:
#   ~/.claude/skills/sb/SKILL.md          → skills/sb/SKILL.md
#   ~/.claude/skills/sb/lib/*.js          → skills/sb/lib/
#   ~/.claude/skills/sb/commands/*.md     → skills/sb/commands/
#   ~/.claude/skills/sb/commands/_runners/*.js → skills/sb/commands/_runners/
#   ~/.claude/hooks/sb-*.js               → skills/sb/hooks/
#
# It does NOT touch install.sh, settings-snippet.json, README.md, docs/, prompts/,
# bin/, vault-templates/ or seeds — those are repo-authored. Review `git status`
# after running, then commit on a feature branch.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SRC_SKILL="$CLAUDE_DIR/skills/sb"
SRC_HOOKS="$CLAUDE_DIR/hooks"

say()  { printf "\033[1;34m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33mWARN:\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mERR:\033[0m %s\n" "$*" >&2; exit 1; }

[ -d "$SRC_SKILL" ] || die "Installed skill not found at $SRC_SKILL — run install.sh first."

say "Mirroring installed → repo ($HERE)"

# SKILL.md
cp "$SRC_SKILL/SKILL.md" "$HERE/SKILL.md"

# lib
mkdir -p "$HERE/lib"
cp "$SRC_SKILL/lib/"*.js "$HERE/lib/"

# commands + runners
mkdir -p "$HERE/commands/_runners"
cp "$SRC_SKILL/commands/"*.md "$HERE/commands/"
cp "$SRC_SKILL/commands/_runners/"*.js "$HERE/commands/_runners/"

# hooks
mkdir -p "$HERE/hooks"
cp "$SRC_HOOKS/sb-"*.js "$HERE/hooks/"

say "Done. Counts:"
printf "  libs:     %s\n" "$(ls "$HERE/lib/"*.js 2>/dev/null | wc -l | tr -d ' ')"
printf "  commands: %s\n" "$(ls "$HERE/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')"
printf "  runners:  %s\n" "$(ls "$HERE/commands/_runners/"*.js 2>/dev/null | wc -l | tr -d ' ')"
printf "  hooks:    %s\n" "$(ls "$HERE/hooks/sb-"*.js 2>/dev/null | wc -l | tr -d ' ')"
echo
say "Review 'git status' / 'git diff', then commit on a feature branch (never main)."
