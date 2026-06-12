#!/usr/bin/env bash
# claude-skills-pack — top-level uninstaller. Calls each per-skill uninstall.sh.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS=("sb" "code_assist" "unabridged")

for s in "${SKILLS[@]}"; do
  if [ -x "$HERE/skills/$s/uninstall.sh" ]; then
    "$HERE/skills/$s/uninstall.sh" || true
  fi
done

echo "All skills uninstalled. Source files in $HERE preserved."
