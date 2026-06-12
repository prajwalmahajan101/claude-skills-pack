#!/usr/bin/env bash
# check_placeholders.sh — flag banned placeholder patterns in a file.
#
# Usage: check_placeholders.sh <file>
# Exit 0: clean.
# Exit 1: banned patterns found; prints "<file>:<line>: <match>" lines.
# Exit 2: usage error.
#
# Skips: binaries, lockfiles, .min.* assets, anything under node_modules / .git / dist / build / vendor.

set -u

if [ $# -lt 1 ]; then
  echo "usage: $0 <file>" >&2
  exit 2
fi

file="$1"

[ -f "$file" ] || exit 0          # vanished file is not a violation
[ -r "$file" ] || exit 0          # unreadable, skip

# Path-based exclusions.
case "$file" in
  */node_modules/*|*/.git/*|*/dist/*|*/build/*|*/vendor/*|*/.next/*|*/.cache/*) exit 0 ;;
  *.min.js|*.min.css|*.lock|*.lockb|*lock.json|*.snap|*.svg|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf|*.zip|*.tar|*.gz) exit 0 ;;
esac

# Skip binaries. `grep -I` reports no match on binary files; on text it matches any char.
if ! LC_ALL=C grep -Iq . "$file" 2>/dev/null; then
  exit 0
fi

# Skip the unabridged skill's own docs — they document banned patterns by example.
case "$file" in
  */skills/unabridged/*) exit 0 ;;
esac

# Patterns. ERE syntax. Keep these aligned with code/SKILL.md.
patterns=(
  '//[[:space:]]*\.\.\.[[:space:]]*$'
  '//[[:space:]]*(rest of (the )?(code|implementation|file)|continue pattern|similar to above|add more as needed)'
  '//[[:space:]]*(TODO|FIXME)([[:space:]:].*)?$'
  '#[[:space:]]*(TODO|FIXME)([[:space:]:].*)?$'
  '//[[:space:]]*(implement (here|me)|placeholder|stub)'
  '#[[:space:]]*(implement (here|me)|placeholder|stub)'
  '/\*[[:space:]]*\.\.\.[[:space:]]*\*/'
  '\(omitted for brevity\)'
  '\(truncated\)'
)

# Run all patterns in one rg/grep pass and emit `file:line: match` lines.
if command -v rg >/dev/null 2>&1; then
  joined=$(IFS='|'; echo "${patterns[*]}")
  hits=$(rg --no-heading --line-number --color=never -e "$joined" "$file" 2>/dev/null || true)
else
  hits=""
  for p in "${patterns[@]}"; do
    out=$(grep -nE "$p" "$file" 2>/dev/null || true)
    [ -n "$out" ] && hits="${hits}${out}"$'\n'
  done
fi

if [ -n "$hits" ]; then
  echo "unabridged: banned placeholder patterns in $file:" >&2
  echo "$hits" | sed -e '/^[[:space:]]*$/d' -e "s|^|$file:|" >&2
  exit 1
fi

exit 0
