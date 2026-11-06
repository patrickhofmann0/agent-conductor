# 0004. Fixed pipeline with configurable review loop

- Status: accepted
- Date: 2026-11-06
- Plan references: D11, D12, D16, D17, D18, D26, D27, D28

## Context

Feature work follows a recurring pattern: clarify requirements, plan, implement, add
tests and guardrails, review, iterate. A fully configurable workflow engine would add
much complexity for little benefit in v1.

## Decision

- Phases are fixed: product owner → planner → coder → tester → checks → reviewer.
- Coder runs before tester (same workspace, sequential).
- The product owner produces requirements, acceptance criteria and open questions; it
  does not hold an interactive dialog. Open questions are shown at the gate.
- Hard checks are shell commands from `conductor.yaml`, executed by the framework (not
  the agents). Their results are input for the reviewer.
- The reviewer returns schema-validated JSON: `verdict`, `route`
  (`coder` | `tester` | `both`), `findings[]`. Invalid output gets up to two retries.
- An `approve` while a required check is red is overridden to `changes_requested`.
- Configurable: max iterations, routing, timeouts (phase and total), cost limit and
  `onLimit` (`draft_pr` default, `fail`, `ask`).

## Consequences

- Simple mental model and state machine, fully testable without I/O.
- Custom roles or graphs need a new decision later (backlog).

## Alternatives considered

- Free workflow graph – too much complexity for v1.
- Tester first (TDD) – rejected by preference; may become configurable later.
- Agents run checks themselves – not trustworthy; the framework must verify.
