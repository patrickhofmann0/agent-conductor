# 0011. Documentation: English Markdown in the repository

- Status: accepted
- Date: 2026-11-06
- Plan references: PLAN chapter 9.13

## Context

So far the repository mainly contains documentation for agents (`AGENTS.md`, ADRs) and
the German project plan. Users who want to adopt conductor and humans who maintain it
need their own, task-oriented documentation. Documentation that drifts from the code is
worse than none.

## Decision

- Human documentation is written in English, as Markdown in the repository. GitHub
  renders it; there is no documentation website for now. Diagrams use Mermaid.
- Structure by audience:
  - `README.md` – entry point: what, why, status, links.
  - `CONTRIBUTING.md` – short entry for contributors.
  - `docs/guide/` – for users of conductor (concepts, getting started locally and in
    CI, configuration, security, troubleshooting). Written alongside the phase that
    delivers the feature.
  - `docs/contributing/` – for maintainers (setup, workflow, guardrails,
    architecture, testing, working with agents, release).
- `AGENTS.md` stays short and agent-oriented. It links to `docs/contributing/` instead
  of duplicating it.
- Every implementation phase includes its documentation in the definition of done.
- Reference documentation that can be generated (e.g. the `conductor.yaml` reference
  from the zod schema) is generated and checked for drift.
- Guardrails:
  - `markdownlint-cli2` (Prettier-compatible style) in `verify` and in the
    pre-commit hook.
  - `remark-validate-links` checks internal links and anchors in `verify` (offline).
  - External links are checked nightly with lychee (`docs-links.yml`) so that
    third-party outages do not block pull requests.
  - The configuration files of these tools are guardrail files.

## Consequences

- Broken internal links or headings fail CI immediately.
- External link rot is detected within a day, but does not block work.
- `docs/PLAN.md` remains German as the internal planning document; it is subject to
  the same lint rules.

## Alternatives considered

- Documentation website (VitePress, Starlight) – more maintenance, not needed yet.
- German documentation – the code, prompts and agent instructions are English, and
  the tool is meant to be reusable by others.
- External link checks in `verify` – flaky and slow.
