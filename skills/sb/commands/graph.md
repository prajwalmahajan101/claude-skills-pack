---
name: sb:graph
description: Build a knowledge graph over the vault (or a project repo) using the graphify skill, and mirror the result (graph.json, GRAPH_REPORT.md, interactive HTML) into 09_Exports/graph.
---

# /sb:graph

graphify is an agent skill, so this runs in three steps:

1. Resolve the target path:

   ```bash
   node ~/.claude/skills/sb/commands/_runners/graph.js resolve            # whole vault
   node ~/.claude/skills/sb/commands/_runners/graph.js resolve --project <slug>
   ```

2. Invoke the **graphify** skill on that path (use the Skill tool / `/graphify "<resolved-path>"`;
   add `--mode deep` for richer edges). graphify writes `graphify-out/` in the target dir.

3. Mirror the output into the vault:

   ```bash
   node ~/.claude/skills/sb/commands/_runners/graph.js mirror --from "<resolved-path>" [--project <slug>]
   ```

The mirror lands in `09_Exports/graph/<label>/` and a link is added to the dashboard Home.
