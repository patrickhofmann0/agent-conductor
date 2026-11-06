# 0006. Git is operated only by the framework

- Status: accepted
- Date: 2026-11-06
- Plan references: D21, D22, D23

## Context

Agents that commit, push or rewrite history can bypass every check and make runs
unreproducible.

## Decision

- Agents are denied `git *`, `gh *` and GitHub network calls via OpenCode permissions.
  This cannot be overridden by configuration.
- After every phase the framework verifies that HEAD, branch, refs, `.git/config` and
  `.git/hooks` are unchanged. Any change fails the run without recovery.
- The framework creates intermediate commits after each phase (needed for draft-PR
  gates and resume). At the end it removes `.conductor/runs/<id>/`, squashes everything
  into one commit and pushes with `--force-with-lease`.
- Before squashing, the framework checks that the branch contains only its own commits;
  otherwise the run stops with `needs_human`.
- Run artifacts (requirements, plan, reviews, state) live in `.conductor/runs/<id>/`
  during the run and end up in the PR body and as archived artifacts.

## Consequences

- Clean history: one commit per feature.
- Force-pushing requires care when humans also push to the branch (handled above).

## Alternatives considered

- Permission only, no verification – agents can write scripts that call git.
- Physically isolated worktree without `.git` – more complex, little extra safety.
