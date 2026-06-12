---
type: topic
slug: <% tp.file.title.toLowerCase().replace(/\s+/g, '-') %>
created: <% tp.date.now() %>
tags: [topic]
---

# <% tp.file.title %>

> Evergreen reference. Update freely; sessions append to the Source Log below.

## Notes


## Related Lessons (auto)
```dataview
LIST FROM "03_Lessons"
WHERE contains(related, "<% tp.file.title.toLowerCase() %>") OR contains(string(tags), "<% tp.file.title.toLowerCase() %>")
SORT date DESC
```

## Source Log

