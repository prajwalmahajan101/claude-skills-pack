# 1. Example decision for conformance fixture

- Status: accepted
- Date: 2026-07-04

## Context
A fixture ADR used by sutra's schema-check conformance test. It must satisfy the ADR interchange spec.

## Decision
We will keep a known-good ADR here so schema-check regressions are caught by the test suite.

## Consequences
schema-check has a stable positive fixture; changing the ADR spec requires updating this file.

## Usage
When the ADR interchange shape changes, update `schema/adr.spec.md` and this fixture together.
