#!/usr/bin/env node
// bases.js — (re)generate Obsidian Bases views over the sb vault.
// Usage: bases.js
//
// Writes 5 .base files into 00_Dashboard/ with concrete, resolved folder paths.
// Idempotent — safe to run repeatedly; /sb:consolidate calls it.
// Bases is a core Obsidian plugin (enabled in this vault); .base files render as
// filterable database tables over notes' frontmatter.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT, DIR, paths } = require(path.join(SKILL_LIB, "vault.js"));

const outDir = path.join(VAULT, DIR.dashboard);
fs.mkdirSync(outDir, { recursive: true });

const FILES = {
  "lessons.base": lessonsBase(),
  "projects.base": projectsBase(),
  "conversations.base": conversationsBase(),
  "tasks.base": tasksBase(),
  "memory.base": memoryBase(),
  "decisions.base": decisionsBase(),
  "journal.base": journalBase(),
  "reviews.base": reviewsBase(),
  "zettel.base": zettelBase(),
  "meetings.base": meetingsBase(),
  "people.base": peopleBase(),
  "habits.base": habitsBase(),
  "unverified.base": unverifiedBase(),
};

const written = [];
for (const [name, body] of Object.entries(FILES)) {
  fs.writeFileSync(path.join(outDir, name), body);
  written.push(`${DIR.dashboard}/${name}`);
}
console.log("Generated Obsidian Bases:");
written.forEach((w) => console.log(`  - ${w}`));

function lessonsBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.lessons}")
    - file.ext == "md"
properties:
  type:
    displayName: Type
  confidence:
    displayName: Confidence
  tags:
    displayName: Tags
  date:
    displayName: Date
views:
  - type: table
    name: Recent
    order:
      - date
      - file.basename
      - tags
      - confidence
    columnSize:
      file.basename: 320
  - type: table
    name: By confidence
    groupBy:
      property: confidence
      direction: ASC
    order:
      - date
      - file.basename
      - tags
`;
}

function projectsBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.projects}")
    - file.ext == "md"
    - note.type == "project-index"
formulas:
  days_since_update: if(updated, (today() - date(updated)).days, "")
properties:
  formula.days_since_update:
    displayName: Stale (days)
  status:
    displayName: Status
  tags:
    displayName: Tags
  path:
    displayName: Path
views:
  - type: table
    name: All
    order:
      - file.basename
      - status
      - tags
      - formula.days_since_update
    columnSize:
      file.basename: 220
      path: 260
`;
}

function conversationsBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.conversations}")
    - file.ext == "md"
properties:
  project:
    displayName: Project
  analyzed:
    displayName: Analyzed
  turn_count:
    displayName: Turns
  last_updated:
    displayName: Updated
  ended_reason:
    displayName: End state
views:
  - type: table
    name: By project
    groupBy:
      property: project
      direction: ASC
    order:
      - last_updated
      - file.basename
      - turn_count
      - analyzed
    columnSize:
      file.basename: 300
  - type: table
    name: Un-analyzed
    filters:
      and:
        - analyzed == false
    order:
      - last_updated
      - project
      - file.basename
`;
}

function tasksBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.projects}")
    - file.ext == "md"
    - note.type == "task"
formulas:
  days_until_due: if(due, (date(due) - today()).days, "")
  overdue: if(due, (today() - date(due)).days > 0, false)
properties:
  formula.days_until_due:
    displayName: Due in (days)
  formula.overdue:
    displayName: Overdue
  status:
    displayName: Status
  due:
    displayName: Due
  project:
    displayName: Project
  tags:
    displayName: Tags
views:
  - type: table
    name: Open
    filters:
      and:
        - status != "done"
    order:
      - formula.overdue
      - due
      - file.basename
      - project
    columnSize:
      file.basename: 240
      project: 150
  - type: table
    name: All
    groupBy:
      property: status
      direction: ASC
    order:
      - due
      - file.basename
      - project
      - tags
`;
}

function memoryBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.memory}")
    - file.ext == "md"
    - note.type == "memory"
properties:
  memory-type:
    displayName: Kind
  description:
    displayName: Description
  origin_session:
    displayName: Origin session
  date:
    displayName: Mirrored
views:
  - type: table
    name: By kind
    groupBy:
      property: memory-type
      direction: ASC
    order:
      - file.basename
      - description
      - date
    columnSize:
      file.basename: 220
      description: 380
`;
}

function decisionsBase() {
  return `filters:
  and:
    - file.ext == "md"
    - note.type == "decision"
properties:
  adr:
    displayName: ADR
  status:
    displayName: Status
  project:
    displayName: Project
  date:
    displayName: Date
  source:
    displayName: Source
views:
  - type: table
    name: By status
    groupBy:
      property: status
      direction: ASC
    order:
      - adr
      - file.basename
      - project
      - date
    columnSize:
      file.basename: 300
  - type: table
    name: By project
    groupBy:
      property: project
      direction: ASC
    order:
      - adr
      - file.basename
      - status
      - date
`;
}

function journalBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.projects}")
    - file.ext == "md"
    - note.type == "journal"
properties:
  project:
    displayName: Project
  phase:
    displayName: Phase
  date:
    displayName: Mirrored
  source_repo:
    displayName: Repo
views:
  - type: table
    name: By project
    groupBy:
      property: project
      direction: ASC
    order:
      - phase
      - file.basename
      - date
    columnSize:
      file.basename: 220
`;
}

function reviewsBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.projects}")
    - file.ext == "md"
    - note.type == "code-review"
properties:
  project:
    displayName: Project
  review_file:
    displayName: File
  date:
    displayName: Mirrored
  source_repo:
    displayName: Repo
views:
  - type: table
    name: By project
    groupBy:
      property: project
      direction: ASC
    order:
      - file.basename
      - review_file
      - date
    columnSize:
      file.basename: 240
`;
}

function zettelBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.zettel}")
    - file.ext == "md"
    - note.type == "zettel"
properties:
  date:
    displayName: Date
  tags:
    displayName: Tags
  verified:
    displayName: Verified
views:
  - type: table
    name: All
    order:
      - date
      - file.basename
      - tags
      - verified
    columnSize:
      file.basename: 380
`;
}

function meetingsBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.meetings}")
    - file.ext == "md"
    - note.type == "meeting"
properties:
  date:
    displayName: Date
  starts_on:
    displayName: Start
  attendees:
    displayName: Attendees
views:
  - type: table
    name: Recent
    order:
      - date
      - file.basename
      - attendees
    columnSize:
      file.basename: 260
`;
}

function peopleBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.people}")
    - file.ext == "md"
    - note.type == "person"
properties:
  role:
    displayName: Role
  company:
    displayName: Company
  relationship:
    displayName: Relationship
  last_interaction:
    displayName: Last seen
views:
  - type: table
    name: All
    order:
      - file.basename
      - role
      - company
      - last_interaction
    columnSize:
      file.basename: 200
`;
}

function habitsBase() {
  return `filters:
  and:
    - file.inFolder("${DIR.habits}")
    - file.ext == "md"
    - note.type == "habit"
properties:
  cadence:
    displayName: Cadence
  streak:
    displayName: Streak
  longest:
    displayName: Longest
views:
  - type: table
    name: Streaks
    order:
      - file.basename
      - streak
      - longest
      - cadence
    columnSize:
      file.basename: 220
`;
}

function unverifiedBase() {
  return `filters:
  and:
    - file.ext == "md"
    - note.verified == false
properties:
  type:
    displayName: Type
  drafted_by:
    displayName: Drafted by
  date:
    displayName: Date
  project:
    displayName: Project
views:
  - type: table
    name: Review queue
    order:
      - date
      - file.basename
      - type
      - drafted_by
    columnSize:
      file.basename: 320
`;
}
