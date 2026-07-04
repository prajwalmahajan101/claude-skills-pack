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

## Anti-patterns (reject in review)
- **N+1 in a loop:** `for u in users: u.orders = db.query(...)`. Fix: one `WHERE user_id IN (...)`
  or a join / dataloader. Confirm with query logs, not intuition.
- **Cross-service DB read:** service A `SELECT`ing service B's table. Fix: call B's API or consume
  its event. Shared tables couple deploys and destroy ownership.
- **Business logic in the controller:** validation + branching + persistence inline in the handler.
  Fix: controller parses/authorizes -> calls a service method -> returns; logic is unit-testable.
- **Unbounded outbound call:** `await fetch(x)` with no timeout/retry/breaker. One slow dependency
  stalls the pool. Fix: timeout + capped retries with jitter; shed load past the budget.
- **Fire-and-forget event with no outbox:** publish inside the same txn as the write but out-of-band,
  so a crash drops the event. Fix: transactional outbox + idempotent consumer (dedupe on event id).
- **Swallowed error / fallback that hides failure:** `except: return []`. Fix: raise with context;
  a caching/degraded path must be explicit and observable (metric + log), never silent.

## Worked example - paginated, safe list endpoint
`GET /v1/orders?cursor=<opaque>&limit=50` → validate limit (cap 100), decode cursor, parameterized
`WHERE account_id = $1 AND id > $2 ORDER BY id LIMIT $3` (account_id from the authz context, never
the query), return `{data, next_cursor}` + RED metrics + correlation id. No offset pagination on hot
tables (it scans); cursor on an indexed key.

## Deeper references (optional, if installed)
`backend-patterns`, `system-design`, `microservices-architect` (agent), `backend-developer`
(agent), `database-optimizer` (agent). Record non-trivial choices as an ADR (`/code_assist:adr`).
