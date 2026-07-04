---
name: code_assist/domains/SKILL-INDEX
description: Complete map of the user's installed skills to code_assist coverage - a condensed playbook, a route to the deeper standalone skill, or a bridge. Makes "absorb everything" explicit even where a playbook is condensed.
type: reference
---

# Skill Index - code_assist coverage of the installed skill library

code_assist carries **condensed, self-contained playbooks** for the operative knowledge, and
names the deeper standalone skill as an optional reference. This index maps every major
installed skill to its coverage: **Playbook** (self-contained here), **Route** (defer to the
standalone skill for depth), or **Bridge** (a sibling skill code_assist hands off to).

## Frontend / UI / UX
| Skill | Coverage |
|---|---|
| frontend-design, taste-skill, soft-skill, minimalist-skill, brutalist-skill, redesign-skill, stitch-skill, image-to-code-skill, brandkit | Playbook `domains/frontend.md` (+ Route for deep specialization) |
| tui-design | Playbook `domains/tui.md` |

## Animation & 3D / WebGL
| Skill | Coverage |
|---|---|
| gsap-scrolltrigger, motion, lottie-animations, locomotive-scroll | Playbook `domains/animation-3d.md` |
| react-three-fiber, r3f-* (fundamentals/interaction/lighting/materials/physics/postprocessing/shaders), threejs-webgl, webgpu-threejs-tsl | Playbook `domains/animation-3d.md` + `domains/web3d.md` |
| web3d-integration-patterns | Playbook `domains/web3d.md` |

## Backend / Architecture / Data
| Skill | Coverage |
|---|---|
| backend-patterns, backend-developer (agent), backend-architect (agent), system-design | Playbook `domains/backend.md` |
| api-design | Playbook `domains/api-design.md` |
| microservices-design, microservices-architect (agent) | Playbook `domains/microservices.md` |
| architecture-decision-records | Family `adr/` (native) |
| supabase, supabase-postgres-best-practices, database-optimizer (agent) | Playbook `domains/data.md` |

## Framework / Platform
| Skill | Coverage |
|---|---|
| vercel:* (nextjs, react-best-practices, shadcn, ai-sdk, deployments-cicd, env-vars, vercel-cli, vercel-functions, ...) | Route (version-pinned); DevOps side in `domains/devops.md` |

## Security / Quality / Testing
| Skill | Coverage |
|---|---|
| tob-static-analysis, static-analysis:{semgrep,codeql,sarif-parsing}, semgrep-rule-creator, sharp-edges, differential-review, audit-context-building | Playbook `domains/security.md` + Family `scan/` |
| testing-handbook-skills:* (aflpp, libfuzzer, cargo-fuzz, atheris, harness-writing, coverage-analysis, address-sanitizer, ...), pr-test-analyzer (agent) | Playbook `domains/testing.md` + Family `test/` |
| code-review, coderabbit, code-simplifier | Family `code-review/` + `refactor/` (native) |

## Dev workflow / Meta
| Skill | Coverage |
|---|---|
| codebase-onboarding | Family `onboard/` (native) |
| search-first, regex-vs-llm-structured-text, context-budget | Route (referenced from `plan`/`domains`) |
| graphify, gitnexus | Family `graph/` (native integration) |
| **sb** (second brain) | **Bridge** - journal/adr/review artifacts -> `/sb:sync-project` (see `bridge/ROUTER.md`) |
| **unabridged** | **Bridge** - full-output families honor the no-truncation rule |
| lessons, remember | Bridge via sb / referenced by `journal` |

## Note
Where a row says **Route**, code_assist deliberately does not duplicate a rich, version-pinned
standalone skill verbatim - it applies the condensed playbook and points to the skill for depth.
This is the pragmatic reading of "absorb everything": complete *coverage* as an index, condensed
*capability* in playbooks, no brittle forks.
