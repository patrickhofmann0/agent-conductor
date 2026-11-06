# 0009. Ports and adapters architecture

- Status: accepted
- Date: 2026-11-06
- Plan references: –

## Context

The orchestration logic (state machine, loop policy, guardrail policy) is the core of
the product and must be thoroughly testable, including mutation testing. Side effects
(OpenCode, git, shell, GitHub, terminal) are slow and hard to test.

## Decision

- `src/core/` contains pure logic and port interfaces; it may only import `zod`,
  `node:path` and other core modules.
- `src/adapters/<name>/` implement ports; they may only import `core/ports` and
  `core/schemas` and never each other.
- `src/cli/` wires adapters into core and is the only place for console output.
- `test/fakes/` contains fake port implementations used by core tests.
- These rules are enforced by dependency-cruiser (`.dependency-cruiser.cjs`).

## Consequences

- Core tests are fast and deterministic; mutation testing is cheap.
- Some indirection for simple operations.

## Alternatives considered

- Direct SDK calls in the orchestration logic – untestable without heavy mocking.
