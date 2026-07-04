---
name: code_assist/domains/microservices
description: Condensed microservices/distributed-systems playbook - boundaries, communication, sagas, resilience, observability. Self-contained.
type: skill
---

# Domain - Microservices / Distributed Systems

## Boundaries
- Split by business capability / bounded context, not by layer. Each service owns its data;
  no shared DB, no cross-service reads. Communicate via API or events.
- Don't start distributed - extract a service only when a boundary and scaling/ownership need is real.

## Communication
- Sync (REST/gRPC) for immediate-response reads; async (events/queues) for work that can defer.
- Contracts are explicit + versioned (OpenAPI/protobuf/AsyncAPI). Consumer-driven contract tests.

## Data consistency
- Prefer eventual consistency across services. **Saga** (choreography or orchestration) for
  multi-service transactions with compensating actions.
- **Transactional outbox** for reliable event publishing (write event + state in one tx; relay
  publishes). Idempotent consumers (dedup by event id).

## Resilience
- Timeouts on every call; retries with backoff + jitter; circuit breakers; bulkheads;
  dead-letter queues for poison messages. Design for partial failure.

## Observability & ops
- Correlation/trace IDs propagated across hops; distributed tracing; RED metrics per service.
- Independent deploy + versioning; API gateway at the edge; service discovery.

## Deeper references (optional)
`microservices-design`, `microservices-architect` (agent), `backend-architect` (agent),
`system-design`. Record boundary/saga/outbox decisions as ADRs.
