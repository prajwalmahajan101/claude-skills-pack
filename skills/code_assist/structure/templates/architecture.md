# Architecture

> High-level map of this system. Keep it current; link ADRs for the "why".

## Overview
One paragraph: what this system does and its top-level shape.

## Components
- **<component>** — responsibility, key interfaces, where it lives (`src/...`).

## Data flow
How a request / event moves through the components (source -> ... -> sink).

## Boundaries & ownership
Service/module boundaries, who owns which schema, sync vs async seams.

## Cross-cutting concerns
Observability, error handling, security boundaries, config/secrets.

## Decisions
See [docs/adr/](adr/) for the recorded architecture decisions.
