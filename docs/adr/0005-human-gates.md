# 0005. Human gates: terminal locally, draft PR in CI

- Status: accepted
- Date: 2026-11-06
- Plan references: D13, D14, D15

## Context

Humans should be able to approve or revise intermediate results (requirements, plan)
before expensive implementation starts. GitHub Actions cannot wait interactively.

## Decision

- Gates are configurable per phase. Defaults: after product owner and after planner.
  The final PR is always the last gate.
- Locally: an interactive terminal prompt shows the artifact and offers approve /
  revise with feedback / abort.
- In CI: one draft PR per run. At a gate the run persists its state
  (`waiting_for_gate`) and the job ends. A PR review "Approve" or the label
  `conductor:approved` resumes the run; "Request changes" repeats the phase with the
  review comments as feedback. Only users with write permission count.

## Consequences

- Runs must be resumable from persisted state (`conductor resume`), which also helps
  local crash recovery.
- Several workflow runs belong to one conductor run; concurrency per issue/PR is
  required.

## Alternatives considered

- GitHub environments with required reviewers – no way to pass feedback.
- One PR per gate, merge = approval – noisy history, many PRs per feature.
- Issue comment commands – possible, but PR reviews are the native review tool.
