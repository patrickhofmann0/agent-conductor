# 0002. TypeScript on Node.js, Bun as tooling

- Status: accepted
- Date: 2026-11-06
- Plan references: D1, D2, D3, D4, D8

## Context

The orchestrator talks to OpenCode through its SDK. The official SDK is TypeScript.
The tool is distributed via npm and must run locally (devcontainer) and in GitHub
Actions. Bun is fast and convenient, but requiring it at runtime adds a dependency for
every user. Node.js 20 reached end of life in April 2026; current Vitest and knip
require Node ≥ 22.12.

## Decision

- Language: TypeScript, pinned to 6.0.x because `typescript-eslint` does not yet
  support TypeScript 7.
- Runtime of the published package: Node.js ≥ 22.12. Only `node:*` APIs are allowed in
  `src/`; `Bun` globals and `bun:*` imports are rejected by ESLint.
- Bun is used for development only: package manager, script runner and bundler
  (`bun build --target=node`). Its version is pinned via `packageManager`.
- Test runner: Vitest (runs on Node, official Stryker support, built-in coverage
  thresholds). `bun test` was rejected because Stryker has no mature runner for it.
- Distribution: npm package `agent-conductor`, binary `conductor`.
- A smoke test runs the built bundle with plain `node` in every CI run.

## Consequences

- `npx agent-conductor` works without Bun.
- Bun-only conveniences (`Bun.spawn`, `Bun.file`, `Bun.$`) are not available.
- Two runtimes are involved in development; the smoke test guards against drift.

## Alternatives considered

- Bun required at runtime – simpler code, but every user needs Bun.
- Python / Go – OpenCode SDKs for these are generated and lag behind.
