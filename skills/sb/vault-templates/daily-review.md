---
type: daily-review
date: <% tp.date.now("YYYY-MM-DD") %>
tags: [daily]
---
# <% tp.date.now("dddd, MMMM Do YYYY") %>

<< [[<% tp.date.now("YYYY-MM-DD", -1) %>|Yesterday]] | [[<% tp.date.now("YYYY-MM-DD", 1) %>|Tomorrow]] >>

## Sessions today
```dataview
TABLE turn_count, project
FROM "01_Conversations"
WHERE last_updated >= date("<% tp.date.now("YYYY-MM-DD") %>")
SORT last_updated DESC
```

## Lessons captured today
```dataview
LIST FROM "03_Lessons" WHERE date = date("<% tp.date.now("YYYY-MM-DD") %>")
```

## Tasks added today
```dataview
LIST FROM "02_Projects" WHERE created >= date("<% tp.date.now("YYYY-MM-DD") %>") AND type = "task"
```

## Notes


## Reflection

