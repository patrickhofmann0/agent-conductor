# Running conductor locally

> Status: local runs work on a branch only. Pull requests and GitHub issues as input
> follow in phase 3 of the [plan](../PLAN.md); until then every `run` and `resume` needs
> `--no-pr`.

## Requirements

- Node.js ≥ 22.12 and git.
- The `opencode` command (OpenCode V2, `npm install -g @opencode/cli`), logged in to a
  model provider. conductor starts its own private OpenCode server for every run.
- A clean working tree: commit or stash your changes before `conductor run`.

## Commands

| Command                                  | What it does                                               |
| ---------------------------------------- | ---------------------------------------------------------- |
| `conductor init`                         | Creates a commented `conductor.yaml`; never overwrites one |
| `conductor validate-config`              | Checks `conductor.yaml` and prints warnings                |
| `conductor run --no-pr "Add CSV export"` | Starts a run on a new branch `conductor/<run-id>-<slug>`   |
| `conductor resume --no-pr <run-id>`      | Continues a run that was interrupted or waits at a gate    |

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
continues. Finished runs are moved to `$XDG_DATA_HOME/agent-conductor/runs/` (by default
`~/.local/share/agent-conductor/runs/`).

## Exit codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | The run finished, waits at a gate or needs a human (draft) |
| 1    | The run failed or was aborted, or an error occurred        |
| 2    | Wrong command-line arguments                               |
