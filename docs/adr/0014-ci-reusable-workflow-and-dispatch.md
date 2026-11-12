# 0014. CI integration: reusable workflow and CI-neutral dispatch

- Status: accepted
- Date: 2026-11-11
- Plan references: D15, D32, D33

## Context

Phase 4 lets target repositories run conductor in CI: an issue label starts a run, pull
request reviews and labels resume it. The original plan used a composite action that
runs inside the target repository's devcontainer (`devcontainers/ci`) with a
conductor devcontainer feature published to GHCR. That makes adoption expensive
(devcontainer, feature, slow container builds on every resume) and puts the event
logic into untested YAML. Other CI systems (Gitea Actions, GitLab CI) may follow.

## Decision

- **`conductor ci`** reads the CI event and decides what to do. The decision is a pure
  function in `core/ci/` over provider-neutral events (`issue_labeled`,
  `review_submitted`, `approval_labeled`, `ignored`): check the trigger label, the
  branch prefix and the actor's permission, derive the run ID from the branch, and
  return `run`, `resume` or `skip`. `run` and `resume` use pull request gates
  (`--gates pr`).
- A port `CiEnvironment` reads the event; `adapters/github-actions/` implements it from
  `GITHUB_EVENT_NAME` and `GITHUB_EVENT_PATH` (validated with zod).
- **Reusable workflow** `.github/workflows/conductor-reusable.yml` in this repository instead of
  a composite action. It checks out, installs conductor and OpenCode, runs
  `conductor ci`, uploads the run artifacts and sets concurrency per issue/PR. Target
  repositories call it from a short workflow that `conductor init --ci` creates.
- **Devcontainer optional:** by default the workflow runs on a plain runner. A later
  input may run inside the target repository's devcontainer. No mandatory
  devcontainer feature, no GHCR publishing in phase 4.
- **Installation before the npm release** (phase 5): the workflow builds conductor
  from the referenced tag or commit; afterwards it installs the published package.
- Only GitHub Actions is implemented. Gitea Actions (largely GitHub-compatible) and
  GitLab CI (no native issue-label trigger, needs a webhook) would add an event
  adapter, a workflow template and a forge adapter; `core` stays unchanged.

## Consequences

- A target repository needs one workflow file, one model provider secret and the
  setting "Allow GitHub Actions to create and approve pull requests".
- Event handling is tested like the rest of the code, with recorded event payloads.
- The reusable workflow lives under `.github/**`, a guardrail path: it ships in its
  own pull request with the `guardrails-change` label, separate from `src/` changes.
- Checks run in the runner's environment unless the devcontainer option is used;
  projects with special toolchains must install them in their workflow or wait for
  that option.
- CI runs cost money unattended: `limits.maxCostUsd` must be set for `conductor ci`.

## Alternatives considered

- Composite action with `devcontainers/ci` (original plan) – heavy adoption, slow
  resumes, logic in YAML.
- Event filtering in workflow YAML only – untestable, duplicated per CI system.
- Generic CI abstraction with adapters for several systems now – speculative until a
  second system is actually needed.
