---
name: sutra:sync
description: Mirror a repo's engineering artifacts into the second-brain vault. Sutra parses .journal/, .code_review/, and ADRs (per the interchange schema it owns) into a payload and feeds sb's generic ingest primitive. Triggers on "sync to vault", "mirror artifacts", "sync project".
argument-hint: [repo path] [--project <slug>]
allowed-tools:
  - Bash
---

# /sutra:sync

1. Build the vault-ingest payload from the repo's artifacts. `$ARGUMENTS` carries the optional
   `[repo path] [--project <slug>]`; when empty, `sync-artifacts` defaults to `.`:

   ```bash
   PAYLOAD="$(mktemp)"
   node ~/.claude/skills/sutra/bin/sutra-tools.js sync-artifacts $ARGUMENTS > "$PAYLOAD"
   ```

   (Optionally `schema-check` the repo first to confirm the producer's output conforms.)

2. If **sb** is present, land the payload in the vault:

   ```bash
   node ~/.claude/skills/sb/commands/_runners/ingest.js --payload "$PAYLOAD"
   ```

   If sb is absent, the payload is still built (report the counts) — the artifacts remain git-tracked
   in the repo; nothing is lost.

3. Report what synced (journals / reviews / decisions / open issues).
