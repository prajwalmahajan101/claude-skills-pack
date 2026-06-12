---
type: project-index
project: PROJECT
path: CWD
created: ISO8601
tags: [project]
---

# PROJECT

**Path:** `CWD`

## Open tasks
```dataview
TASK FROM "02_Projects/PROJECT/tasks" WHERE !completed
```

## Recent lessons
```dataview
LIST FROM "03_Lessons" WHERE source_project = "PROJECT" SORT date DESC LIMIT 10
```

## Sessions
```dataview
TABLE turn_count, last_updated FROM "01_Conversations/PROJECT" SORT last_updated DESC LIMIT 5
```

## Kanban
[[kanban]]

## Lessons (project-scoped rollup)
[[lessons]]

## Plans
```
ls plans/
```
