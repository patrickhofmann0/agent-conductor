# 0010. Machine-enforced guardrails for this repository

- Status: accepted
- Date: 2026-11-06
- Plan references: D35, D36, PLAN chapter 9

## Context

This project is developed AI-first. Anything an agent can get wrong must be rejected by
a machine; prose in `AGENTS.md` is guidance, not enforcement. Agents also tend to relax
rules to get green, so the guardrails themselves need protection.

## Decision

All checks run through one command, `bun run verify`, locally and in CI:

| Area         | Tool / rule                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types        | TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …                                                                                                            |
| Lint         | ESLint `strictTypeChecked`; no `any`, `as` (except `as const`), `!`, `@ts-ignore`, default exports, `Bun`; size and complexity limits; justified disables only, never for guardrail rules |
| Format       | Prettier                                                                                                                                                                                  |
| Architecture | dependency-cruiser (ADR 0009)                                                                                                                                                             |
| Dead code    | knip                                                                                                                                                                                      |
| Tests        | Vitest; every source file needs a sibling test (`*.types.ts` exempt and types-only); coverage ≥ 90 % in core, ≥ 80 % elsewhere; no `.only`/`.skip`                                        |
| Mutation     | Stryker, break threshold 80, on PRs touching `src/` and nightly                                                                                                                           |
| Hooks        | lefthook: pre-commit format/lint/typecheck, commit-msg Conventional Commits, pre-push `verify:fast`                                                                                       |
| Build        | Bundle with Bun, smoke test with Node                                                                                                                                                     |

Protection of the guardrails:

- Guardrail files are listed in `scripts/guardrails.ts` and `.github/CODEOWNERS`.
- The `guardrails` workflow fails if a PR changes guardrail files (or `package.json`
  scripts) unless a user with admin/maintain permission added the label
  `guardrails-change`, and the PR does not change `src/` or `test/`.
- Branch protection on `main` requires `verify` and `guardrails`, code owner review,
  linear history, squash merge only (`scripts/setup-github.sh`).

## Consequences

- Higher initial setup cost, slower commits (hooks).
- Agents get fast, unambiguous feedback and cannot quietly weaken checks.
- Guardrail changes are deliberate, separate PRs.
- The maintainer is the only code owner; merging their own guardrail PRs requires an
  admin bypass (`enforce_admins: false`).

## Alternatives considered

- Biome instead of ESLint – faster, but fewer rules (typed rules, comment restrictions).
- `bun test` – no mature Stryker support.
- No guardrail protection – every other guardrail could be silently weakened.
