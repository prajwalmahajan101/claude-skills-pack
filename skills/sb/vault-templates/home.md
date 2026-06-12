---
type: dashboard
tags: [dashboard]
---

# ai-mind 🧠

## Today
[[<% tp.date.now("YYYY-MM-DD") %>]]

## Active projects
```dataview
TABLE WITHOUT ID file.link AS Project, length(file.outlinks) AS Links
FROM "02_Projects"
WHERE type = "project-index"
SORT file.mtime DESC
LIMIT 10
```

## Recent lessons
```dataview
LIST FROM "03_Lessons" SORT date DESC LIMIT 10
```

## Open tasks across all projects
```dataview
TASK FROM "02_Projects" WHERE !completed GROUP BY file.folder LIMIT 15
```

## Recurring themes
![[08_Insights/recurring-themes]]
