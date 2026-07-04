---
name: code_assist/incident/postmortem
description: Write a blameless postmortem into docs/incidents/NNNN-*.md - impact, timeline, proven root cause, resolution, and preventive action items recorded as risks that `recall` surfaces later.
type: skill
---

# Incident - Postmortem

Goal: turn an outage into durable prevention. Blameless - the target is the system and process
that allowed the failure, never a person.

## Steps (one todo each)
1. **Open/locate the record:** the `docs/incidents/NNNN-*.md` from `incident-scaffold` (create it
   now if the hotfix skipped it: `incident-scaffold --title "<...>" --apply`).
2. **Impact** - who/what was affected, duration, magnitude. Be concrete (requests, users, data).
3. **Timeline (UTC)** - detection → mitigation → resolution, with timestamps. Include how it was
   *detected* (that gap is often its own action item).
4. **Root cause** - the **proven** mechanism (reproduced during the hotfix). Blameless framing.
5. **Resolution** - what stopped the bleeding and the fresh evidence that verified it.
6. **Action items** - preventive work so this *class* of failure can't recur (detection, guardrail,
   test, rollback path). Assign owners. Mark the durable ones for the next step.
7. **Capture the lesson (closed loop):** record the durable takeaways as a lesson tagged **risk**.
   `recall` then surfaces it in future plan/debug/review and at session start - so future work
   learns from the outage.

## Rules
- Blameless. "The deploy step had no smoke test" - not "X forgot to test".
- Every action item has an owner and is preventive (stops the class, not just this instance).
- The lesson is the payoff - an incident with no captured risk is an incident you'll repeat.
