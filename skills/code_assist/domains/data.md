---
name: code_assist/domains/data
description: Condensed data/Postgres/Supabase playbook - schema, indexing, RLS/auth, query performance. Self-contained.
type: skill
---

# Domain - Data (Postgres / Supabase)

## Schema
- Model for the query patterns you actually have. Normalize by default; denormalize only with
  a measured reason. Constraints (FK, unique, check, not-null) enforce invariants in the DB.
- Migrations are forward-only and reviewed; never edit a shipped migration.

## Indexing & query performance
- Index the columns you filter/join/order by; composite indexes match query column order.
- Read the plan (`EXPLAIN (ANALYZE, BUFFERS)`); fix seq-scans on hot paths; avoid N+1 from the
  app layer. Keep transactions short; avoid long-held locks.

## Supabase specifics
- **RLS is the security boundary** - enable it and write policies per table; never rely on the
  client. Use `auth.uid()` in policies; test policies as different roles.
- Prefer `@supabase/ssr` for session handling in SSR frameworks; use `getUser()` (verifies)
  over `getSession()` for authorization decisions. Keep service-role keys server-only.
- Edge Functions for server logic; `pg_cron`/`pgmq` for scheduled/queue work; `pgvector` for
  embeddings.

## Rules
- Secrets/keys from env; never commit them. Parameterized queries only.
- Record schema/protocol decisions as an ADR (`/code_assist:adr`). Never delegate migrations
  to an unattended agent.

## Deeper references (optional, if installed)
`supabase`, `supabase-postgres-best-practices`, `database-optimizer` (agent).
