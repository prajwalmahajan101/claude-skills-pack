---
name: sb:sync-project
description: Mirror a repo's in-repo knowledge into the vault — phase journals (.journal/M*.md) and code-review state (.code_review/) become AI-first notes under 02_Projects/<slug>/{journal,reviews}/, and open review issues surface in the project INDEX.
---

# /sb:sync-project

Current repo (auto-detected from cwd):

```bash
node ~/.claude/skills/sb/commands/_runners/sync-project.js
```

A specific repo / project, or every known repo:

```bash
node ~/.claude/skills/sb/commands/_runners/sync-project.js --repo /path/to/repo --project myslug
node ~/.claude/skills/sb/commands/_runners/sync-project.js --all
```

Read-only on the repo — it never writes to `.journal/` or `.code_review/`. Mirrors are
overwritten each run (idempotent). Show output verbatim.
