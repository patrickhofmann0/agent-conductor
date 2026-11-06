# 0007. Guardrails and least privilege in target repositories

- Status: accepted
- Date: 2026-11-06
- Plan references: D19, D20, D29

## Context

A coder agent under pressure to turn checks green tends to weaken tests or lint rules
instead of fixing code.

## Decision

- The tester creates guardrails: tests, static rules (lint, type, architecture) and CI
  checks.
- The coder may not change guardrails. The guardrail set is: files matching
  `guardrails.paths` plus every file the tester created or changed in this run.
- Coder changes to guardrails are reverted by the framework and reported as a
  high-severity finding to reviewer and coder. The revert does not count as an extra
  iteration.
- Tool permissions per role are minimal: product owner, planner and reviewer are
  read-only; coder and tester may edit and use bash, never git.

## Consequences

- Tests can only be weakened by the tester, and the reviewer sees every such change.
- Glob patterns must be maintained per target repo.

## Alternatives considered

- No restriction, rely on the reviewer – too easy to miss.
- Abort the run on violation – too harsh; agents often touch files accidentally.
