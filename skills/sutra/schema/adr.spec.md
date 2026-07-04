# Interchange schema — ADR

**Producer:** code_assist `adr` family · **Consumer:** sb vault (ingested as project decisions).

Sutra owns this contract. code_assist writes its own ADR format standalone; sutra's `schema-check`
asserts that output still matches this spec.

## Location & filename
- ADRs live at `<repo_root>/docs/adr/`.
- Files are named `NNNN-<slug>.md` — a zero-padded monotonic number + a kebab slug.
  Regex: `^[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$`.
- `0000-template.md` is the template and is excluded from conformance.

## Required structure
1. H1 header carrying the ADR number that matches the filename. Both forms are accepted:
   `# NNNN. <title>` (canonical) and `# ADR NNNN: <title>` (common variant).
2. A Status line — `proposed | accepted | superseded`. Bold labels are accepted:
   `- Status: accepted` or `- **Status:** Accepted`.
3. A Date line — `YYYY-MM-DD`. Bold labels accepted: `- Date: …` or `- **Date:** …`.
4. The four canonical sections: `## Context`, `## Decision`, `## Consequences`, `## Usage`.

## Conformance
`schema-check` reports an ADR as **conforming** when the filename matches, the H1 number agrees with the
filename number, the Status + Date lines are present and well-formed, and all four sections exist. A
missing section or malformed Status/Date is a violation (error).
