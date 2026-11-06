# Guardrails

This repository is developed AI-first. Every rule that matters is enforced by a machine,
because prose rules are easy to overlook — for agents and for humans. This page explains
each guardrail: what it checks, why it exists and what to do when it fails.

The golden rule: **when a guardrail fails, change your code, not the guardrail.**

All checks run with one command, locally and in CI:

```bash
bun run verify        # everything
bun run verify:fast   # everything except build and Node smoke test
```

## Overview

| Guardrail                                     | Tool                             | Command                          |
| --------------------------------------------- | -------------------------------- | -------------------------------- |
| [Formatting](#formatting)                     | Prettier                         | `bun run format:check`           |
| [Markdown](#markdown-and-links)               | markdownlint-cli2                | `bun run docs:lint`              |
| [Internal links](#markdown-and-links)         | remark-validate-links            | `bun run docs:links`             |
| [Lint rules](#lint-rules)                     | ESLint                           | `bun run lint`                   |
| [Types](#types)                               | TypeScript                       | `bun run typecheck`              |
| [Architecture](#architecture)                 | dependency-cruiser               | `bun run arch`                   |
| [Dead code](#dead-code)                       | knip                             | `bun run deadcode`               |
| [Test pairs](#test-pairs)                     | `scripts/verify-test-pairs.ts`   | `bun run test:pairs`             |
| [Schema drift](#schema-drift)                 | `scripts/verify-schema-drift.ts` | `bun run schema:check`           |
| [Tests and coverage](#tests-and-coverage)     | Vitest                           | `bun run test`                   |
| [Node compatibility](#node-compatibility)     | Bun build + Node                 | `bun run build && bun run smoke` |
| [Mutation testing](#mutation-testing)         | Stryker                          | `bun run mutation`               |
| [Commit messages](#commit-messages)           | commitlint                       | `commit-msg` hook                |
| [Guardrail protection](#guardrail-protection) | `scripts/verify-guardrails.ts`   | CI only                          |

## Formatting

**What:** Prettier with default settings for code, JSON, YAML and Markdown.
**Why:** No time spent on style discussions; diffs only show real changes.
**When it fails:** run `bun run format`.

## Markdown and links

**What:** markdownlint (Prettier-compatible rules) and a check that every relative link
and heading anchor in Markdown files exists. External links are checked nightly by the
`docs-links` workflow.
**Why:** Documentation is part of the product. Broken links are the most common form of
documentation rot.
**When it fails:** fix the reported line. For a missing anchor, check the exact heading
text — anchors are lowercase, spaces become `-`, punctuation is dropped.

## Lint rules

**What:** ESLint with `typescript-eslint` strict type-checked rules plus project rules:

| Rule                                                                            | Reason                                                                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| No `any`, no `as` casts (except `as const`), no `!`                             | Agents use these to silence the type checker. Validate data with zod instead.                                    |
| No `@ts-ignore`; `@ts-expect-error` only with a reason                          | Same reason                                                                                                      |
| No `Bun` globals or `bun:*` imports                                             | The published package must run on plain Node.js ([ADR 0002](../adr/0002-typescript-node-runtime-bun-tooling.md)) |
| Named exports only                                                              | Consistent imports, better refactoring and dead-code detection                                                   |
| `no-console` outside `src/cli/`                                                 | Output is a CLI concern; core logic must stay testable                                                           |
| Max 250 lines/file, 60 lines/function, complexity 10, depth 3, 3 parameters     | Small units are easier to review, test and mutate. Agents tend to grow god functions                             |
| `eslint-disable` needs a description and may not disable any of the rules above | Prevents silent opt-outs                                                                                         |
| No `.only` / `.skip` in tests, every test asserts                               | Prevents accidentally disabled or empty tests                                                                    |
| `*.types.ts` files contain types only                                           | They are exempt from the test-pair rule                                                                          |

**When it fails:** fix the code. For size and complexity limits, split the function or
module — extract a helper, use a lookup table instead of a long `if` chain, group
parameters into an options object.

## Types

**What:** `tsc` in strict mode with `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` and other strict flags (`tsconfig.json`).
**Why:** Catches whole classes of bugs before tests run. `noUncheckedIndexedAccess`
forces handling of missing array and record entries.
**When it fails:** handle the `undefined` case explicitly. With
`exactOptionalPropertyTypes`, do not assign `undefined` to an optional property — omit
it instead.

## Architecture

**What:** dependency-cruiser enforces the ports-and-adapters layering
([architecture](architecture.md), [ADR 0009](../adr/0009-ports-and-adapters.md)):
core is pure, adapters only see ports and schemas and never each other, nothing imports
the CLI, no cycles, no orphan modules, no dev dependencies in shipped code.
**Why:** Keeps the core testable without I/O and stops coupling from creeping in.
**When it fails:** the message names the rule and the offending import. Usually the
fix is to define or extend a port in `src/core/ports/` and implement it in an adapter.

## Dead code

**What:** knip reports unused files, exports, types and dependencies.
**Why:** Agents often leave behind helpers and exports that nothing uses.
**When it fails:** delete the unused code or dependency. If something is used only
from tests, it probably should not be exported.

## Test pairs

**What:** every `src/**/*.ts` needs a sibling `*.test.ts`. Exempt: `index.ts` (wiring
only) and `*.types.ts` (types only, enforced by ESLint).
**Why:** Makes missing tests visible immediately instead of hiding behind an overall
coverage number.
**When it fails:** add the test file next to the source file.

## Schema drift

**What:** `conductor.schema.json` (the JSON schema users reference from their
`conductor.yaml`) is generated from the zod schema via `configJsonSchema()` in
`src/core/config/json-schema.ts`. The check regenerates it and compares it with the
committed file. It also fails if the file exists but the generator is gone.
**Why:** The zod schema is the single source of truth. A hand-edited or stale JSON
schema would give users wrong editor hints.
**When it fails:** run `bun run schema:generate` and commit the result. Never edit
`conductor.schema.json` by hand.

## Tests and coverage

**What:** Vitest with V8 coverage. Thresholds: 90 % (lines, branches, functions,
statements) for `src/core/**`, 80 % for everything else.
**Why:** Coverage is a floor, not a goal; it catches untested branches.
**When it fails:** the report lists uncovered lines. Add tests for the behavior, or
remove the branch if it is unreachable.

## Node compatibility

**What:** the CLI is bundled with `bun build --target=node` and run with plain `node`.
**Why:** Bun is only a development tool; users run conductor on Node.js.
**When it fails:** you probably used a Bun-only API or a dependency that does not work
on Node.

## Mutation testing

**What:** Stryker changes the code in small ways (mutants) and checks that at least one
test fails for each. The mutation score must be ≥ 80. Runs on pull requests that change
`src/` and nightly. See [testing](testing.md#mutation-testing).
**Why:** Coverage only shows that code ran, not that tests would notice a bug. AI
generated tests often assert too little.
**When it fails:** open the HTML report (`reports/mutation/mutation.html` locally, or
the `mutation-report` artifact in CI) and add assertions that kill the surviving
mutants.

## Commit messages

**What:** Conventional Commits, checked by commitlint in the `commit-msg` hook. See
[workflow](workflow.md#commits).

## Guardrail protection

The guardrails above are only as strong as their configuration. An agent stuck on a
failing check might lower a coverage threshold or relax a lint rule instead of fixing
the code. Therefore the configuration itself is protected.

**Guardrail files:** `tsconfig*.json`, `eslint.config.js`, `.prettierrc*`,
`.prettierignore`, `.dependency-cruiser.cjs`, `knip.json`, `vitest.config.ts`,
`stryker.config.json`, `lefthook.yml`, `commitlint.config.js`,
`.markdownlint-cli2.jsonc`, `.remarkrc.json`, `.remarkignore`, everything in
`.github/` and `scripts/`, `AGENTS.md`, and the `scripts` section of `package.json`.

The list lives in `scripts/guardrails.ts` and `.github/CODEOWNERS`; keep both in sync.

**Enforcement:**

- The `guardrails` CI check fails when a pull request changes a guardrail file, unless
  the label `guardrails-change` was added by a user with admin or maintain permission,
  **and** the pull request changes nothing in `src/` or `test/`.
- Branch protection requires a code owner review for guardrail files.

### Changing a guardrail

Sometimes a guardrail really needs to change — a new tool version, a rule that turned
out to be wrong, a new protected file.

1. Create a branch that changes **only** guardrail files (plus documentation if needed).
2. Explain in the pull request why the change is necessary and why it does not weaken
   the project. If it does weaken a check, say so explicitly.
3. A maintainer reviews it and adds the `guardrails-change` label.
4. Merge it. Then rebase your feature branch on `main`.

If you are an AI agent: never do this on your own. Stop and ask a human.
