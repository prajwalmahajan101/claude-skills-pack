---
name: sb:graduate
description: Promote a captured idea into a real project — ensures 02_Projects/<slug>/ (INDEX + kanban), seeds kanban cards from the idea's bullets, and flips the idea to status: graduated with a backlink. Use for "turn this idea into a project", "start a project from this idea", "graduate this idea".
---

# /sb:graduate

```bash
node ~/.claude/skills/sb/commands/_runners/graduate.js "<idea-slug-or-path>" [--project <slug>]
```

Seeds one kanban card per bullet under the idea's `## Idea` section (backlinked to
the idea note), sets the idea `status: graduated` + `graduated_to`, and adds a
`## Graduated` backlink. Project slug defaults to the idea's title (override with
`--project`). Refuses to re-graduate an already-graduated idea. Show output verbatim.
