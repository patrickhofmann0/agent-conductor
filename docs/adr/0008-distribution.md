# 0008. Distribution: npm package, devcontainer feature, GitHub Action

- Status: accepted
- Date: 2026-11-06
- Plan references: D7, D8, D9, D10, D31, D32, D33, D34

## Context

The framework is reusable across arbitrary repositories and must behave identically
locally and in CI.

## Decision

- npm package `agent-conductor` with the CLI `conductor`.
- A devcontainer feature installs OpenCode and conductor into the target repo's
  devcontainer.
- A composite GitHub Action runs conductor inside that devcontainer via
  `devcontainers/ci`, so local and CI environments are the same.
- Input: a GitHub issue (CI, triggered by the label `conductor`) or free text (CLI).
- Output: a pull request; locally `--no-pr` creates only a branch.
- Artifact and PR text language is configurable.
- This repository has its own devcontainer for framework development.

## Consequences

- Target repos need a devcontainer that includes the feature.
- CI is slower due to the container build; prebuilt images can mitigate this.

## Alternatives considered

- Template repository – copies drift and cannot be updated centrally.
- Prebuilt image only – less flexible than a feature for existing devcontainers.
- Action directly on the runner – environment differs from local.
