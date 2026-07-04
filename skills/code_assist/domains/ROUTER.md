---
name: code_assist/domains/ROUTER
description: Domain playbooks - condensed, self-contained capability for backend, frontend, data, animation/3D, and TUI work, so code_assist can guide domain implementation without depending on external plugins. Routes intent to the right playbook.
type: router
---

# Domains Router

Self-contained, condensed playbooks. They carry the operative principles so code_assist can
act without a plugin dependency. When a heavier, specialized standalone skill exists and is
installed, these playbooks name it as the deeper reference - but never require it.

| Intent | Playbook |
|---|---|
| Service architecture / boundaries / resilience / RBAC | `backend.md` |
| REST/API design - resources, status codes, pagination, versioning | `api-design.md` |
| Microservices / sagas / outbox / distributed systems | `microservices.md` |
| Supabase / Postgres / RLS / query & schema perf | `data.md` |
| Security - authz, secrets, injection, static analysis | `security.md` |
| Testing strategy / property / fuzzing / coverage | `testing.md` |
| DevOps / CI-CD / containers / IaC / Vercel deploys | `devops.md` |
| Landing page / UI / design system / "not templated" | `frontend.md` |
| GSAP / Motion / Three.js / R3F / WebGL / scroll | `animation-3d.md` |
| Combining 3D + animation libraries (architecture/perf) | `web3d.md` |
| Terminal UI / CLI dashboard / Bubble Tea / Ratatui | `tui.md` |

Full coverage map of the installed skill library (playbook / route): `SKILL-INDEX.md`.

## How to use
1. Load the matching playbook; apply its principles to the task.
2. Combine with the process families: `plan` the work, `test`-drive it, `verify`, `commit`.
3. For deep specialization the playbook points to the relevant standalone skill (optional).

These are Flexible skills - adapt the principles to the concrete context.
