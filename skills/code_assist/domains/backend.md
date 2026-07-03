---
name: code_assist/domains/backend
description: Condensed backend engineering playbook - API design, service boundaries, resilience, observability, security. Self-contained; mirrors the project's backend defaults.
type: skill
---

# Domain - Backend

## API design
- REST by default; gRPC/GraphQL only with explicit justification.
- Versioned endpoints, consistent error envelopes, pagination + rate limits at the edge.
- Validate at boundaries; parameterized queries only.

## Service boundaries & data
- Each service owns its schema. No cross-service DB reads - communicate via API or events.
- Layering: controller -> service -> repository. Business logic in the service layer;
  controllers thin; repositories swappable.
- Prefer async (events/queues) for inter-service work; reserve sync for immediate-response.
  Idempotent consumers + transactional outbox for event producers.

## Resilience
- Circuit breakers on every outbound call; timeouts everywhere; retries with backoff + jitter;
  dead-letter queues for poison messages.

## Observability
- Structured logs with correlation IDs; RED metrics (rate/errors/duration) per endpoint;
  distributed traces across service hops.

## Performance
- Budget p95 < 200ms for user-facing endpoints unless documented. Profile before optimizing.
- Watch for N+1 queries; index for the query patterns; cache with clear invalidation.

## Security
- Secrets from env/secret-manager, never in code. RBAC with least privilege.
- Audit-log sensitive mutations. Validate + authorize at every boundary.

## Deeper references (optional, if installed)
`backend-patterns`, `system-design`, `microservices-architect` (agent), `backend-developer`
(agent), `database-optimizer` (agent). Record non-trivial choices as an ADR (`/code_assist:adr`).
