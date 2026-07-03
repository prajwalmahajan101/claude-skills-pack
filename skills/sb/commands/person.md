---
name: sb:person
description: Create or update a people/CRM note — role/company/email + a running interaction log. Referenced by meetings and lessons. Use for "remember this person" or logging an interaction.
---

# /sb:person

```bash
node ~/.claude/skills/sb/commands/_runners/person.js "<name>" [--role r] [--company c] [--email e] [--linkedin l] [--relationship weak|medium|strong] [--log "<interaction>"]
```

`--log` appends a dated line to the interaction log and bumps `last_interaction`. Show output
verbatim.
