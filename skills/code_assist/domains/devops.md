---
name: code_assist/domains/devops
description: Condensed DevOps/deploy playbook - CI/CD, containers, IaC, Vercel deploys, observability. Self-contained.
type: skill
---

# Domain - DevOps / Deploy

## CI/CD
- CI on every PR: lint + type check + tests + build (see `structure/templates/ci.*.yml`).
- CD: automated, reproducible, rollback-able. Tag-driven releases (see `release/`).
- Keep pipelines fast; cache deps; fail early; required checks before merge.

## Containers & IaC
- Small, pinned base images; multi-stage builds; non-root; healthchecks. Scan images.
- Infrastructure as code (Terraform/Ansible): `*.example` vars, no secrets committed, plan
  before apply, state locked. Reviewable, versioned, reproducible.

## Vercel / frontend deploys
- Preview deploy per PR; promote to production explicitly. Env vars per environment via the
  platform, never in the repo. Edge/runtime caching with clear invalidation.
- Watch bundle size and Core Web Vitals; use the platform's build cache.

## Observability & ops
- Structured logs + correlation IDs; RED metrics; traces; alerts on SLOs, not noise.
- Health/readiness endpoints; graceful shutdown; zero-downtime deploys.

## Deeper references (optional)
`vercel:*` (deployments-cicd, env-vars, vercel-cli, vercel-functions, ...), `infra`-style repos
as structure exemplars. Secrets from a secret-manager; audit sensitive infra changes via ADRs.
