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

## Anti-patterns (reject in review)
- **Testing the mock:** asserting a mock was called with args you also hard-coded - proves nothing
  about behavior. Fix: assert the observable outcome (returned value, persisted row, emitted event).
- **Change-detector test:** asserts internal call order / private state, breaks on every refactor.
  Fix: test the public contract; if it can't be observed from outside, question whether to test it.
- **Non-deterministic test:** depends on wall-clock, network, random, or test order. Fix: inject a
  clock, stub the boundary, seed randomness, isolate state. A flaky test is a failing test.
- **Assertion-free / happy-path-only:** exercises code but asserts nothing, or never covers the
  error/edge branch. Fix: assert the result AND at least one failure mode per unit.
- **Coverage-chasing:** tests written to hit a % on trivial getters. Fix: cover behavior and edges;
  coverage is a signal, not the target.

## Worked example - a real regression test (bug-first)
A bug: `parseAmount("1,000")` returns `1`. The fix is not "wrap in try/catch". First write
`assert parseAmount("1,000") == 1000` - watch it FAIL on the current code (proves it reproduces the
bug), then fix the parser at the root, then watch it pass. The test now guards the behavior forever.

## Deeper references (optional)
`pr-test-analyzer` (agent), the `testing-handbook-skills:*` set (aflpp, libfuzzer, cargo-fuzz,
atheris, harness-writing, coverage-analysis, address-sanitizer), `constant-time-testing`.
