#!/usr/bin/env bash
# claude-skills-pack — top-level installer.
# Usage:
#   ./install.sh            # interactive prompt per skill, then offer marketplace
#   ./install.sh --all      # install every skill + register the marketplace
#   ./install.sh sb code_assist   # install only the named skills
#   ./install.sh --marketplace    # only (re)register the plugin marketplace

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS=("sb" "code_assist" "unabridged" "sutra")

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

# Register this repo as a Claude Code plugin marketplace (idempotent; best-effort).
# The manifest at .claude-plugin/marketplace.json lists all three plugins.
register_marketplace() {
  if ! command -v claude >/dev/null 2>&1; then
    skip "claude CLI not on PATH — skipped marketplace registration."
    echo "     To register later:  claude plugin marketplace add \"$HERE\""
    return 0
  fi
  say "Registering plugin marketplace → claude plugin marketplace add"
  if claude plugin marketplace add "$HERE" 2>/dev/null; then
    ok "marketplace registered (claude-skills-pack)"
  else
    # Already added, or the CLI version differs — refresh, else print the manual command.
    if claude plugin marketplace update claude-skills-pack >/dev/null 2>&1; then
      ok "marketplace already present — refreshed"
    else
      skip "could not auto-register; run:  claude plugin marketplace add \"$HERE\""
    fi
  fi
  echo "     Then install a plugin:  /plugin install code_assist@claude-skills-pack"
}

if [ "${1:-}" = "--marketplace" ]; then
  register_marketplace
  exit 0
fi

if [ "${1:-}" = "--all" ]; then
  for s in "${SKILLS[@]}"; do run_installer "$s"; done
  register_marketplace
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

read -r -p "Register the plugin marketplace (claude plugin marketplace add)? [Y/n] " ans
case "${ans:-Y}" in
  [Nn]*) skip "marketplace — skipped" ;;
  *)     register_marketplace ;;
esac

say "All selections processed."
