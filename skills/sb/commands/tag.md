---
name: sb:tag
description: Auto-tag notes using rules from `_meta/tag-rules.json`. Usage — `/sb:tag` (all untagged) or `/sb:tag <path-to-note.md>`.
---

# /sb:tag

```bash
node ~/.claude/skills/sb/commands/_runners/tag.js $ARGUMENTS
```

With no arg: scans vault for notes whose frontmatter has empty `tags:`, applies rules, rebuilds `tags.md`. With a path: tags that one file. Show single-line output.
