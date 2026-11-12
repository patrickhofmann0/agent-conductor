# 0013. GitHub access via the `gh` CLI

- Status: accepted
- Date: 2026-11-11
- Plan references: D9, D10, D15, D32

## Context

Phase 3 needs a small set of GitHub operations: read an issue, create and update a
pull request, switch it between draft and ready, set and remove labels, and read
reviews and comments since a point in time. Options were Octokit, a hand-written
`fetch` client, or the GitHub CLI `gh` as a subprocess.

## Decision

- The forge adapter (`src/adapters/github-cli/`) calls `gh` via `execFile`, like the
  git adapter calls `git`.
- Reads use `gh api` (versioned REST JSON, `--paginate` where needed); every response
  is validated with zod. Writes use high-level commands where they save code
  (`gh pr create --draft`, `gh pr edit`, `gh pr ready`, `gh pr ready --undo`).
- Authentication is left to `gh`: `gh auth login` locally, `GH_TOKEN` /
  `GITHUB_TOKEN` in CI. A preflight runs `gh auth status` and checks a minimum `gh`
  version before a run that needs GitHub.
- Errors (exit code + stderr) are mapped to clear messages: not authenticated, not
  found, rate limited, other.
- The `Forge` port hides `gh` completely; `core` never sees it.

### Provider neutrality

- The `Forge` port and `core` use provider-neutral types: `authorCanApprove`
  instead of GitHub's `author_association`, review states
  `approve | request_changes | comment`, issue references as opaque strings parsed and
  formatted only by the adapter, and `closingReference(ref)` for the "Closes …"
  keyword in the PR body.
- Adapters are named `<provider>-cli`. Another forge (e.g. GitLab via `glab`) needs
  only a new adapter and a config option `forge`; `core` stays unchanged.
- v1 ships GitHub only. No generic CLI layer beyond a shared `exec` helper, and no
  second adapter in advance. CI integration (phase 4) stays GitHub-specific.

## Consequences

- No npm dependency, small bundle; pagination, retries and GraphQL (draft ↔ ready)
  come from `gh`.
- `gh` becomes a runtime requirement. It is preinstalled on GitHub runners, but CI runs
  inside the devcontainer, so the conductor devcontainer feature (8.1) must install
  it (or depend on `ghcr.io/devcontainers/features/github-cli`).
- Tests inject the process runner and assert exact `gh` arguments against recorded
  JSON fixtures; no HTTP mocking.
- Switching to a `fetch` client later only touches the adapter.

## Alternatives considered

- Octokit – several packages, larger bundle, typed responses we would still have to
  validate with zod.
- Own `fetch` client – no dependency, but pagination, rate limits, error handling and
  GraphQL for draft ↔ ready would be our code to maintain.
