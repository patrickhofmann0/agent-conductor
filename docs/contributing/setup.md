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

2. On first creation the container installs the pinned Bun version, OpenCode and the
   GitHub CLI (`.devcontainer/on-create.sh`), then runs `bun install`.
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
script and OpenCode for trying conductor end to end.

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

## GitHub repository settings

After the repository is created and `main` is pushed, a maintainer runs once:

```bash
scripts/setup-github.sh patrickhofmann0/agent-conductor
```

The script is idempotent. It configures squash-only merging, creates the labels
(`conductor`, `conductor:approved`, `conductor:needs-human`, `guardrails-change`) and
protects `main` (required checks `verify` and `guardrails`, code owner review for
guardrail files, linear history, no force pushes).
