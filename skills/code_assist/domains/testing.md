---
name: code_assist/domains/testing
description: Condensed testing playbook - the pyramid, behavioral testing, property/fuzz, coverage discipline. Self-contained; complements the test/ (TDD) family.
type: skill
---

# Domain - Testing

## Strategy
- Test **behavior and observable outcomes**, not implementation details. Prefer
  integration/e2e over heavily-mocked unit tests; do not chase a coverage number.
- Pyramid: many fast unit tests, fewer integration, a thin e2e layer for critical journeys.
- Every bug fix ships with a regression test that fails without the fix (see `debug`/`test`).

## Kinds
- **Unit** - pure logic, fast, deterministic. **Integration** - real DB/queue/HTTP boundaries.
- **e2e** - user journeys through the running system. **Contract** - consumer-driven for services.
- **Property-based** - assert invariants over generated inputs (Hypothesis/fast-check/proptest).
- **Fuzzing** - for parsers/protocols/untrusted input: libFuzzer/AFL++/cargo-fuzz/atheris; add a
  harness, a seed corpus + dictionary, and run under sanitizers (ASan). Wire into CI/OSS-Fuzz.

## Discipline
- Deterministic tests (no time/network/order flakiness); isolate state; one reason to fail.
- Fast feedback: unit suite in seconds. Quarantine + fix flaky tests, don't ignore them.
- Coverage is a signal, not a target - cover behavior and edge cases, not lines for their own sake.

## Deeper references (optional)
`pr-test-analyzer` (agent), the `testing-handbook-skills:*` set (aflpp, libfuzzer, cargo-fuzz,
atheris, harness-writing, coverage-analysis, address-sanitizer), `constant-time-testing`.
