# Running conductor locally

> Status: local runs work on a branch only. Pull requests and GitHub issues as input
> follow in phase 3 of the [plan](../PLAN.md); until then every `run` and `resume` needs
> `--no-pr`.

## Requirements

- Node.js ≥ 22.12 and git.
- The `opencode` command (OpenCode V2, `npm install -g @opencode/cli`), logged in to a
  model provider. conductor starts its own private OpenCode server for every run.
  Run `opencode` once to check that a model answers.
- At least one commit on the base branch (`git.baseBranch`, default `main`): conductor
  creates its branch from there.
- A clean working tree: commit or stash your changes before `conductor run`. This
  includes `conductor.yaml` itself.

## Installation

conductor is not published to npm yet. Build it from source and link the `conductor`
command:

```bash
git clone https://github.com/patrickhofmann0/agent-conductor.git
cd agent-conductor
bun install
bun run build   # creates dist/index.js
npm link        # makes `conductor` available globally
conductor --version
```

Without `npm link`, an alias works too:
`alias conductor="node /path/to/agent-conductor/dist/index.js"`.

## Quickstart in an empty repository

```bash
mkdir demo && cd demo
git init -b main
echo "# Demo" > README.md
conductor init               # creates a commented conductor.yaml
```

Before the first run, edit `conductor.yaml`:

- Set a model under `models.default`, for example `anthropic/claude-sonnet-4-5`.
  Without one, OpenCode's default model is used.
- Set a low `limits.maxCostUsd`, for example `2`.
- Add `checks` once there is something to check (for example `npm test`). Without
  checks, only the reviewer judges the result.

Then validate, commit and start the run:

```bash
conductor validate-config
git add -A && git commit -m "chore: initial"
conductor run --no-pr "Create a small Node.js CLI that prints the current date, with tests"
```

conductor prints `Starting run <run-id>`; keep the ID for `resume`.
`conductor show <run-id>` prints the requirements, the plan and every review, also for
archived runs. When the run is done, the result is a single commit on
`conductor/<run-id>-<slug>`:

```bash
git log --oneline main..HEAD
git show
```

## Commands

| Command                                  | What it does                                               |
| ---------------------------------------- | ---------------------------------------------------------- |
| `conductor init`                         | Creates a commented `conductor.yaml`; never overwrites one |
| `conductor validate-config`              | Checks `conductor.yaml` and prints warnings                |
| `conductor run --no-pr "Add CSV export"` | Starts a run on a new branch `conductor/<run-id>-<slug>`   |
| `conductor resume --no-pr <run-id>`      | Continues a run that was interrupted or waits at a gate    |
| `conductor runs`                         | Lists open runs: ID, status, step, branch and start time   |
| `conductor show <run-id>`                | Shows a run with history, requirements, plan and reviews   |

All commands work in the current directory, which must be the repository root. Progress
and questions go to stderr; `run` and `resume` print one result line to stdout:
`<run-id> <status> <branch>`.

## Gates

With `gates.po` and `gates.planner` enabled (the default), conductor shows the
requirements and the plan and asks:

- `a` approve
- `r` revise: type your feedback and finish it with an empty line
- `e` revise in your editor (`$VISUAL`, then `$EDITOR`, then `vi`); lines starting with
  `#` are ignored
- `x` abort, with an optional reason

With `loop.onLimit: ask`, conductor also asks at a limit whether to continue with
another budget, finish as a draft or abort.

## Interrupting and resuming

The run state is saved in `.conductor/runs/<run-id>/` after every step. Press Ctrl-C at
any time; `conductor resume --no-pr <run-id>` repeats the interrupted step and
continues. `conductor runs` shows the run IDs of all open runs. It reads the working
tree, so run it on the run's branch, where conductor left you. Finished runs are moved
to `$XDG_DATA_HOME/agent-conductor/runs/` (by default
`~/.local/share/agent-conductor/runs/`).

## Exit codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | The run finished, waits at a gate or needs a human (draft) |
| 1    | The run failed or was aborted, or an error occurred        |
| 2    | Wrong command-line arguments                               |
