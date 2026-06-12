---
name: code_assist/code-review/backend
description: Backend-flavored weights and anti-patterns for code review (servers, APIs, data layers, workers)
type: variant
---

# Code Review — Backend Variant

Use this weight table when reviewing a backend service (REST/RPC server, worker, ETL, etc.). Combine with `shared.md`.

---

## Weight Table

| Category | Weight |
|---|---|
| Architecture & Design Patterns | 2.0 |
| Model Design & Data Integrity | 2.0 |
| Error Handling & Safety | 1.8 |
| Security (non-auth) | 1.8 |
| Separation of Concerns & Layering | 1.8 |
| Code Structure & Organization | 1.5 |
| Logging & Observability Readiness | 1.5 |
| API Design & Contract Consistency | 1.5 |
| Resilience & Fault Tolerance | 1.5 |
| Configuration & Environment Management | 1.2 |
| Dependency Management | 1.2 |
| Performance Considerations | 1.2 |
| Scalability | 1.2 |
| Extensibility & Maintainability | 1.2 |
| Documentation & Readability | 1.0 |
| Naming Quality | 1.0 |

---

## Anti-Pattern Checklist (Step 3)

Explicitly look for and call out:

- **Data layer**: N+1 queries, missing indexes, missing transactions on multi-write paths, implicit `SELECT *`, unbounded result sets without pagination.
- **Concurrency / I/O**: synchronous I/O on async paths, blocking calls inside event loops, missing timeouts on network calls, unbounded queues, fire-and-forget tasks without supervision.
- **Layering**: handlers reaching into models or DB directly, business logic embedded in serializers/DTOs, leaky abstractions across packages, god services.
- **Error handling**: bare `except` / `catch (_)`, swallowed exceptions, missing retry / backoff, inconsistent error envelopes across endpoints.
- **Config / secrets**: hardcoded credentials, env vars read at random call sites, mutable global state, missing distinction between dev/prod config.
- **Security (non-auth)**: SQL injection vectors, SSRF risks, path traversal, deserialization of untrusted data, missing input validation at boundaries, unsanitized log fields.
- **API design**: inconsistent verbs/status codes, response shape drift across endpoints, missing pagination/filtering/sorting contracts, breaking changes without versioning.
- **Observability readiness**: log statements without correlation IDs, missing structured logging, no health endpoints, no metrics surface.

Use this list as a checklist during Step 3 of `shared.md`.
