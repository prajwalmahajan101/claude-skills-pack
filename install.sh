#!/usr/bin/env bash
# claude-skills-pack — top-level installer.
# Usage:
#   ./install.sh            # interactive prompt per skill
#   ./install.sh --all      # install every skill non-interactively
#   ./install.sh sb code_assist   # install only the named skills

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS=("sb" "code_assist" "unabridged")

say()  { printf "\033[1;34m==>\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m ✓ \033[0m %s\n" "$*"; }
skip() { printf "\033[1;33m ↷ \033[0m %s\n" "$*"; }

run_installer() {
  local skill="$1"
  if [ ! -x "$HERE/skills/$skill/install.sh" ]; then
    chmod +x "$HERE/skills/$skill/install.sh" 2>/dev/null || true
  fi
  say "Installing $skill…"
  "$HERE/skills/$skill/install.sh"
  ok "$skill done"
  echo
}

if [ "${1:-}" = "--all" ]; then
  for s in "${SKILLS[@]}"; do run_installer "$s"; done
  exit 0
fi

if [ $# -gt 0 ]; then
  for s in "$@"; do
    if [[ " ${SKILLS[*]} " == *" $s "* ]]; then
      run_installer "$s"
    else
      echo "Unknown skill: $s (choices: ${SKILLS[*]})" >&2
      exit 1
    fi
  done
  exit 0
fi

echo "claude-skills-pack installer"
echo "============================"
for s in "${SKILLS[@]}"; do
  read -r -p "Install $s? [Y/n] " ans
  case "${ans:-Y}" in
    [Nn]*) skip "$s — skipped" ;;
    *)     run_installer "$s" ;;
  esac
done

say "All selections processed."
