# agent-conductor

Orchestrates AI agents on top of [OpenCode](https://opencode.ai) to implement features:
product owner → planner → coder → tester → reviewer, with a configurable review loop.
Runs locally in a devcontainer and in GitHub Actions; the result is a pull request.

> Status: Phase 0 (foundation and guardrails). Not usable yet. See [docs/PLAN.md](docs/PLAN.md).

## Development

Open the repository in its devcontainer, or install Node ≥ 22.12 and Bun (version in
`package.json#packageManager`), then:

```bash
bun install
bun run verify
```

Read [AGENTS.md](AGENTS.md) before contributing. It applies to humans and AI agents
alike. Architecture decisions are in [docs/adr](docs/adr).

After creating the GitHub repository, a maintainer runs `scripts/setup-github.sh` once
to configure branch protection, merge settings and labels.
