---
name: code_assist/journal/new
description: Create a fresh journal entry for the current phase from TEMPLATE.md, pre-populated from git state
type: subskill
---

# Journal — New Entry

Create a brand-new `M<phase>.md` in `.journal/` by cloning `TEMPLATE.md` and pre-filling everything derivable from git.

Inherits structure and rules from `shared.md`.

---

## Step 1: Resolve Inputs

In parallel:

```bash
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
git rev-parse main 2>/dev/null || git rev-parse master 2>/dev/null
git log --oneline $(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master)..HEAD
git status --short
```

Then:

1. Compute `<repo_root>/.journal/` path.
2. Determine phase identifier (see `shared.md` → Phase Identifier).
3. Confirm the target file `<repo_root>/.journal/M<phase>.md` **does not already exist**. If it does, stop and route the user to the **update** sub-skill.
4. Read `<repo_root>/.journal/TEMPLATE.md` if present; otherwise use the canonical structure from `shared.md`.

---

## Step 2: Gather Context

Pull just enough to pre-populate the header and "What I did":

- Branch name + base SHA → header line.
- Phase title — ask the user if not derivable from branch name or open plan.
- Commits since base → seed "What I did" bullets (one bullet per commit, type+summary).
- ADR / plan references → scan `docs/adr/` and `<repo_root>/plans/` or `.planning/` for files touching this phase.

Do **not** invent "Problems I faced" content. Leave it as a placeholder comment for the user to fill in as the phase progresses.

---

## Step 3: Render the Entry

Write `<repo_root>/.journal/M<phase>.md` with all canonical sections from `shared.md`, in order. Rules:

- **Header / Branch / Goal / Plan** — fully populated from git + user-supplied goal.
- **What I did** — seeded with commit bullets, marked `<!-- seeded from git log; trim/refine -->`.
- **Problems I faced** — leave a single placeholder paragraph: `<!-- log problems here as they happen -->`.
- **What could have been done better** — placeholder: `<!-- retrospective; fill at phase close -->`.
- **Changes carried back to earlier phases** — default to `none` with a placeholder comment.
- **What's next** — both sub-bullets present, content left as placeholder comments.
- **Journal** — empty, with a placeholder comment `<!-- chronological dev log starts here -->`.

---

## Step 4: Report

Print one short confirmation:

```
Created .journal/M<phase>.md (seeded from <N> commits since <base-sha>).
Open it to fill in Goal, Plan, and start logging.
```

Do not echo the full file body back into the chat.

---

## Stop Here

Do not commit the new journal file. Leave staging to the user (or to `/code_assist:git_commit`).
