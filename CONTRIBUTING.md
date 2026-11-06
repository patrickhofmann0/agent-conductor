# Contributing

Thanks for helping with agent-conductor. This project is developed AI-first: much of the
code is written by AI agents, and machine-enforced guardrails keep the quality up. The
same rules apply to humans and agents.

## Quick start

1. Open the repository in its devcontainer (recommended), or install Node.js ≥ 22.12
   and the Bun version from `package.json#packageManager`. See [setup](docs/contributing/setup.md).
2. Install dependencies: `bun install` (also installs the git hooks).
3. Check that everything is green: `bun run verify`.

## Definition of done

A change is done when `bun run verify` passes, the documentation is updated and, for
architectural decisions, an ADR exists. CI runs exactly the same checks.

## Read more

| Topic                                                           | What you learn                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Setup](docs/contributing/setup.md)                             | Devcontainer, local tooling, git hooks, GitHub repository settings |
| [Workflow](docs/contributing/workflow.md)                       | Branches, commits, pull requests, merging                          |
| [Guardrails](docs/contributing/guardrails.md)                   | Every automated check, why it exists, what to do when it fails     |
| [Architecture](docs/contributing/architecture.md)               | Ports and adapters, where new code goes                            |
| [Testing](docs/contributing/testing.md)                         | Test layout, fakes, coverage, mutation testing                     |
| [Working with agents](docs/contributing/working-with-agents.md) | How to use AI agents effectively and safely in this repository     |
| [AGENTS.md](AGENTS.md)                                          | The condensed rules given to AI agents                             |
| [ADRs](docs/adr)                                                | Why things are the way they are                                    |
