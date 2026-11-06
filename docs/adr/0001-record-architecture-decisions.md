# 0001. Record architecture decisions

- Status: accepted
- Date: 2026-11-06
- Plan references: –

## Context

The project is developed AI-first. Agents start every session without memory, so the
reasons behind decisions must live in the repository, close to the code.

## Decision

We record every architecturally significant decision as an ADR in `docs/adr/`, using
`0000-template.md`. ADRs are numbered sequentially and never deleted; a decision that
changes is marked `superseded` and points to its replacement. `docs/PLAN.md` holds the
overall plan and the decision table D1–D36; ADRs group those decisions by topic and
explain them.

## Consequences

- Agents and humans can look up why something is the way it is before changing it.
- A new architectural decision without an ADR is a review finding.

## Alternatives considered

- One ADR per plan decision (36 files) – too fragmented, many decisions only make
  sense together.
- Decisions only in `docs/PLAN.md` – the plan describes the target state, not the
  reasoning, and changes over time.
