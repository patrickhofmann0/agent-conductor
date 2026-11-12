# 0015. Guardrail assistant mode

- Status: accepted
- Date: 2026-11-12
- Plan references: D20, D37

## Context

conductor protects guardrails in target repositories (ADR 0007), but it relies on the
repository already having good guardrails and quality gates. Many projects lack them,
and setting them up per language is tedious. Agents working in weakly guarded
repositories produce weaker results.

## Decision

- Add a separate mode `conductor guardrails` in v1 (plan section 4.5, phase 7).
- Steps: read-only analysis → deterministic gap analysis in `core` → proposal →
  mandatory human gate → implementation by coder and tester → review focused on
  weakening → pull request labeled `guardrails-change` without product code changes.
- The guardrail catalog is data (zod schema): a language-neutral core plus language
  profiles mapping each gate to tools. v1 profiles: TypeScript/JS, Python, Go,
  Java/Kotlin. Monorepos are handled per subproject.
- Existing gates may only be tightened. Weakening produces a `high` finding.
- `--report-only` produces the proposal without changing files.

## Consequences

- Target repositories get a guided path to safe guardrails before feature runs.
- New port `RepoInspector` and a new role (guardrail analyst).
- Maintaining language profiles and pinned tool versions is ongoing work.

## Alternatives considered

- Report only – leaves the hardest part (correct tool setup) to the developer.
- TypeScript only – simpler, but excludes most target repositories.
- Static templates without agents – cannot adapt to existing setups.
