---
name: code_assist/journal/update
description: Append to or refine an existing journal entry — log a new event, ratify a decision, close out a phase
type: subskill
---

# Journal — Update Existing Entry

Append to or refine an existing `M<phase>.md` based on recent git activity and the user's intent.

Inherits structure and rules from `shared.md`.

---

## Step 1: Locate the Entry

```bash
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
ls .journal/ 2>/dev/null
```

Pick the target entry via the rules in `shared.md` → Phase Identifier. If no entry exists, stop and route to **new**.

Read the existing entry in full so additions match its voice and don't duplicate content.

---

## Step 2: Detect Intent

Decide which section(s) the update belongs in:

| Signal | Section |
|---|---|
| User says "I shipped …", new commits since last update | `## What I did` |
| User says "I hit …", "got stuck on …", bug or quirk discovered | `## Problems I faced` |
| User says "in hindsight …", "should have …" | `## What could have been done better` |
| Refactor of an earlier phase's file appears in diff | `## Changes carried back to earlier phases` |
| Open question, deferral, v2 idea | `## What's next` |
| Free-form thought, timestamped note, commit SHA reference | `## Journal` |

Multiple sections may be touched in one update. When ambiguous, default to `## Journal` (the free-form chronological log).

---

## Step 3: Gather Evidence

If updating `## What I did`:

```bash
git log --oneline <last-recorded-sha>..HEAD
```

Add one bullet per new commit, matching the existing voice. Reference SHAs.

If updating `## Problems I faced`: ask the user for one paragraph — what shape did the problem take, how did it fight back, what unlocked it. Do not invent.

If updating `## Journal`: append a new entry. Timestamp optional but encouraged: `### YYYY-MM-DD HH:MM` or `### <commit-sha>`.

---

## Step 4: Edit the File

Use targeted edits — never rewrite the whole file. Preserve existing structure, ordering of bullets, and prior content verbatim except where the user asked to revise.

Rules:

- **Append, do not replace.** New bullets at the end of their section's list; new paragraphs after existing ones.
- **Convert `none` placeholders** to real content when a section gains its first entry.
- **Replace placeholder comments** (`<!-- … -->`) with real content silently.
- **Do not reorder** existing bullets unless the user asks.

---

## Step 5: Report

One short confirmation listing exactly which sections changed:

```
Updated .journal/M<phase>.md:
  + ## What I did (+2 bullets)
  + ## Journal (+1 entry)
```

Do not echo the full file body.

---

## Stop Here

Do not commit the updated journal. Leave staging to `/code_assist:git_commit`.
