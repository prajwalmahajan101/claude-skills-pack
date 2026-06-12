---
type: weekly-review
week: <% tp.date.now("gggg-[W]ww") %>
tags: [weekly]
---
# Week <% tp.date.now("gggg-[W]ww") %>

> Auto-synthesized body lives below; `/sb:weekly` overwrites it. This template provides the scaffolding.

## Themes
_populated by /sb:weekly_

## Top Learnings
_populated by /sb:weekly_

## Action Items Still Open
```dataview
TASK FROM "02_Projects" WHERE !completed AND created >= date(today) - dur(7 days)
```

## Patterns
_populated by /sb:weekly_

## Lessons captured this week
```dataview
LIST FROM "03_Lessons" WHERE date >= date(today) - dur(7 days) SORT date DESC
```
