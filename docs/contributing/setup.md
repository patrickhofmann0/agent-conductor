# Setup

There are two ways to work on agent-conductor. The devcontainer is recommended because
it matches CI exactly.

## Option A: devcontainer (recommended)

Requirements: Docker and an editor with devcontainer support (VS Code with the Dev
Containers extension, JetBrains Gateway) or the
[devcontainer CLI](https://github.com/devcontainers/cli).

1. Open the repository and choose **Reopen in Container**, or run:

   ```bash
   npx @devcontainers/cli up --workspace-folder .
   npx @devcontainers/cli exec --workspace-folder . bash
   ```

2. On first creation the container installs the pinned Bun version, OpenCode V2
   (`@opencode/cli` from npm) and the GitHub CLI (`.devcontainer/on-create.sh`), then runs
   `bun install`.
3. Run `bun run verify`.

The container is based on `mcr.microsoft.com/devcontainers/typescript-node:22` and runs
as user `node`.

## Option B: local tooling

1. Install Node.js ≥ 22.12.
2. Install the Bun version from `package.json#packageManager`:

   ```bash
   curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.4"
   source ~/.bashrc
   ```

3. `bun install`
4. `bun run verify`

Optional: the [GitHub CLI](https://cli.github.com) (`gh`) for the repository setup
script, and OpenCode V2 for trying conductor end to end. Install OpenCode with
`npm install --global @opencode/cli@2.2.5`; the `curl` installer from opencode.ai still
installs V1 ([ADR 0012](../adr/0012-opencode-v2-client-and-private-server.md)).

## Git hooks

`bun install` installs [lefthook](https://lefthook.dev) hooks through the `prepare`
script:

| Hook         | Runs                                                             |
| ------------ | ---------------------------------------------------------------- |
| `pre-commit` | Prettier check, markdownlint, ESLint on staged files, type check |
| `commit-msg` | commitlint (Conventional Commits)                                |
| `pre-push`   | `bun run verify:fast`                                            |

Hooks source `scripts/hook-env.sh` first. It adds `~/.bun/bin` (or `$BUN_INSTALL/bin`)
to `PATH` when Bun is installed but not on the `PATH`, which is common in GUI git
clients. If Bun is missing entirely, the hook stops with an explanation.

Do not skip hooks with `--no-verify`. CI runs the same checks, so skipping only moves
the failure to later.

### Troubleshooting

| Symptom                                         | Fix                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `bun not found` in a hook                       | Install Bun (see above) or work in the devcontainer                    |
| Hooks do not run at all                         | Run `bun install` again, or `bunx lefthook install`                    |
| `pre-push` is slow                              | It runs the full fast verification. That is intended                   |
| Commit rejected with `subject may not be empty` | Use a Conventional Commit message, see [workflow](workflow.md#commits) |

## Running an agent inside the devcontainer

Run OpenCode inside the devcontainer to let an agent work on this repository with the
same toolchain as CI, isolated from the rest of your machine.

### Start

With VS Code, choose **Reopen in Container** and open a terminal. With the CLI:

```bash
npx @devcontainers/cli up --workspace-folder .
npx @devcontainers/cli exec --workspace-folder . opencode
```

### Sign in once

The container does not see your host credentials. Its OpenCode login, OpenCode settings
and GitHub CLI login live in Docker volumes that survive container rebuilds:

| Volume                                 | Mounted at                |
| -------------------------------------- | ------------------------- |
| `agent-conductor-opencode-data-<id>`   | `~/.local/share/opencode` |
| `agent-conductor-opencode-config-<id>` | `~/.config/opencode`      |
| `agent-conductor-opencode-state-<id>`  | `~/.local/state/opencode` |
| `agent-conductor-gh-config-<id>`       | `~/.config/gh`            |

After the first start:

1. Start `opencode` and connect your model provider.
2. Sign in to GitHub and let git use it for pushes:

   ```bash
   gh auth login
   gh auth setup-git
   ```

3. Set your git identity if your editor does not forward it (VS Code does, the
   devcontainer CLI does not):

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

To sign out completely, remove the volumes with `docker volume rm`.

### Hand over context

A new session in the container does not know earlier conversations. Everything an agent
needs is in the repository: [AGENTS.md](../../AGENTS.md) is loaded automatically, the
current phase and its tasks are in the [plan](../PLAN.md), and decisions are in the
[ADRs](../adr). A good first prompt:

```text
Read AGENTS.md, docs/PLAN.md (the current phase) and the ADRs it references.
Implement the next open task on a new branch from main, one small step at a time,
and run `bun run verify` after each step. Check library types in node_modules
before using an API.
```

See [working with agents](working-with-agents.md) for how to cut tasks and review the
results.

### Notes

- `node_modules` lives in the mounted repository and is shared between host and
  container. This works because both are Linux x64. Do not run `bun install` on both
  sides at the same time.
- Agents in the container can still reach the network and everything in the
  repository. The container protects your host, not the repository.

## GitHub repository settings

After the repository is created and `main` is pushed, a maintainer runs once:

```bash
scripts/setup-github.sh patrickhofmann0/agent-conductor
```

The script is idempotent. It configures squash-only merging, creates the labels
(`conductor`, `conductor:approved`, `conductor:needs-human`, `guardrails-change`) and
protects `main` (required checks `verify` and `guardrails`, code owner review for
guardrail files, linear history, no force pushes).
