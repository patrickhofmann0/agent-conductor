# AGENTS.md

Instructions for AI agents (and humans) working on this repository.

## What this is

`agent-conductor` orchestrates AI agents (product owner → planner → coder → tester →
reviewer, with a reviewer loop) on top of OpenCode to implement features. It runs
locally in a devcontainer and in GitHub Actions. The full plan is in `docs/PLAN.md`;
decisions are recorded in `docs/adr/`.

## Definition of done

`bun run verify` passes. Nothing else counts. Run it before you consider a task finished.

| Command               | Purpose                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `bun run verify`      | Everything CI runs (format, lint, types, architecture, dead code, test pairs, tests + coverage, build, Node smoke test) |
| `bun run verify:fast` | `verify` without build and smoke test                                                                                   |
| `bun run test:watch`  | Vitest in watch mode                                                                                                    |
| `bun run mutation`    | Stryker mutation testing (score must be ≥ 80)                                                                           |
| `bun run format`      | Apply Prettier                                                                                                          |

## Architecture rules (enforced by dependency-cruiser)

- `src/core/` – pure orchestration logic. No I/O, no SDKs, no `node:*` except `node:path`.
  Only `zod` and other `core` modules.
- `src/core/ports/` – interfaces for every side effect.
- `src/adapters/<name>/` – implement ports. May import only `core/ports` and
  `core/schemas`. Never another adapter.
- `src/cli/` – entry point. Wires adapters into core. Only place allowed to use `console`.
- `test/fakes/` – fake port implementations. May import only `core`.
- No circular dependencies. `src/` never imports from `test/`.

## Code rules (enforced by ESLint/TypeScript)

- Shipped code must run on plain Node.js ≥ 22: use `node:*` APIs, never `Bun.*` or `bun:*`.
  Bun is only our package manager, script runner and bundler.
- No `any`, no `as` casts (except `as const`), no `!` non-null assertions, no `@ts-ignore`.
  Validate unknown data with zod instead of casting.
- Named exports only.
- Limits: 250 lines per file, 60 lines per function, complexity 10, depth 3, 3 params.
  If you hit a limit, split the code. Do not work around it.
- `eslint-disable` needs a description and may never disable a guardrail rule.

## Tests

- Every `src/**/*.ts` needs a sibling `*.test.ts` (exempt: `index.ts`, `*.types.ts`).
  `*.types.ts` files may only contain types and interfaces.
- Coverage: ≥ 90 % for `src/core/**`, ≥ 80 % elsewhere.
- No `.only`, no `.skip`. Every test must assert something.
- Test behavior through public functions. Use fakes from `test/fakes/` instead of mocks
  where a port exists.

## Guardrails are off-limits

These files define how the project is verified. **Do not modify them** as part of a
feature or fix. If a guardrail blocks you, change your code, not the guardrail:

`tsconfig*.json`, `eslint.config.js`, `.prettierrc*`, `.prettierignore`,
`.dependency-cruiser.cjs`, `knip.json`, `vitest.config.ts`, `stryker.config.json`,
`lefthook.yml`, `commitlint.config.js`, `.github/**`, `scripts/**`, `AGENTS.md`,
`package.json` scripts.

CI rejects PRs that change them unless a maintainer adds the `guardrails-change` label,
and such PRs must not touch `src/` or `test/`.

## Working practices

- Look up current APIs in `node_modules/**/*.d.ts` or official docs before using a
  library. Do not rely on memory for OpenCode, Stryker, ESLint or GitHub Actions APIs.
- Keep dependency versions pinned exactly.
- Git hooks (lefthook) source `scripts/hook-env.sh`, which adds `~/.bun/bin` to `PATH`
  if needed. Never bypass hooks with `--no-verify`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`).
- New architectural decisions need an ADR in `docs/adr/` (copy `0000-template.md`).
- Code, comments, prompts and commit messages are in English.
