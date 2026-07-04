---
name: code_assist/domains/api-design
description: Condensed REST/API design playbook - resource modeling, status codes, pagination, versioning, errors, rate limits. Self-contained.
type: skill
---

# Domain - API Design

## Resources & methods
- Model nouns as resources; use HTTP verbs for actions (GET/POST/PUT/PATCH/DELETE).
- Plural, lowercase, hyphenated paths (`/users/{id}/api-keys`). No verbs in paths.
- GET is safe + idempotent; PUT/DELETE idempotent; POST creates.

## Status codes
- 200 OK, 201 Created (+ `Location`), 202 Accepted (async), 204 No Content.
- 400 validation, 401 unauth, 403 forbidden, 404 not found, 409 conflict, 422 semantic,
  429 rate-limited, 5xx server. Be consistent.

## Payloads & errors
- Consistent error envelope: `{ "error": { "code", "message", "details" } }`. Stable machine
  `code`s. Never leak stack traces.
- Validate at the boundary; reject unknown fields or ignore consistently.

## Pagination, filtering, sorting
- Cursor pagination for large/hot lists (stable under writes); offset only for small sets.
- `?filter[x]=`, `?sort=-created_at`, `?page[size]=`. Return `next`/`prev` cursors.

## Versioning & evolution
- Version at the edge (`/v1/`), additive changes preferred; deprecate with headers + a sunset date.
- Rate limits + quotas at the gateway; return `RateLimit-*` headers.

## Cross-cutting
- Idempotency keys for unsafe retries; ETags/conditional requests for concurrency.
- Document with OpenAPI 3.1; generate clients from the spec.

## Deeper references (optional)
`api-design`, `backend-patterns`, `graphql-architect` (agent). Record protocol choices as an ADR.
