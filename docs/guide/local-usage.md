# Running conductor locally

> Status: local runs push their branch and open a pull request on GitHub, or work on a
> local branch only with `--no-pr`. Running in GitHub Actions follows in phase 4 of the
> [plan](../PLAN.md).

## Requirements

- Node.js ≥ 22.12 and git.
- The `opencode` command (OpenCode V2, `npm install -g @opencode/cli`), logged in to a
  model provider. conductor starts its own private OpenCode server for every run.
  Run `opencode` once to check that a model answers.
- At least one commit on the base branch (`git.baseBranch`, default `main`): conductor
  creates its branch from there.
- For pull requests and issues: the [GitHub CLI](https://cli.github.com) `gh` 2.40 or
  newer, logged in with `gh auth login` (or `GH_TOKEN` set), and a remote `origin` on
  GitHub. conductor checks this before any agent starts. Not needed with `--no-pr`.
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

Without `--no-pr`, conductor pushes the branch to `origin` and opens a pull request: a
draft while the run works, ready for review when it is done.

conductor prints `Starting run <run-id>`; keep the ID for `resume`.
`conductor show <run-id>` prints the requirements, the plan and every review, also for
archived runs. When the run is done, the result is a single commit on
`conductor/<run-id>-<slug>`:

```bash
git log --oneline main..HEAD
git show
```

## Commands

| Command                          | What it does                                                 |
| -------------------------------- | ------------------------------------------------------------ |
| `conductor init`                 | Creates a commented `conductor.yaml`; never overwrites one   |
| `conductor validate-config`      | Checks `conductor.yaml` and prints warnings                  |
| `conductor run "Add CSV export"` | Starts a run on a new branch `conductor/<run-id>-<slug>`     |
| `conductor run --issue #42`      | Same, implementing a GitHub issue (`#42` or `owner/repo#42`) |
| `conductor resume <run-id>`      | Continues a run that was interrupted or waits at a gate      |
| `conductor revise <run-id> "…"`  | Reopens a finished run with feedback (see below)             |
| `conductor runs`                 | Lists open runs: ID, status, step, branch and start time     |
| `conductor show <run-id>`        | Shows a run with history, requirements, plan and reviews     |

Options for `run`, `resume` and `revise`:

- `--no-pr`: work on the local branch only; no push, no pull request, no `gh` needed.
  `run --issue` still reads the issue with `gh`.
- `--gates pr`: answer gates with pull request reviews instead of the terminal
  (see [Gates on the pull request](#gates-on-the-pull-request)). Pass it again on
  `resume`.

All commands work in the current directory, which must be the repository root. Progress
and questions go to stderr; `run`, `resume` and `revise` print one result line to
stdout: `<run-id> <status> <branch>`.

## Gates

With `gates.po` and `gates.planner` enabled (the default), conductor shows the
requirements and the plan and asks:

- `a` approve
- `r` revise: type your feedback and finish it with an empty line
- `e` revise in your editor: write the feedback in a file instead of the terminal (see
  [Writing feedback in the editor](#writing-feedback-in-the-editor))
- `x` abort, with an optional reason

With `gates.final: true`, conductor also stops before finishing an approved result and
shows the reviewer's summary, the check results and the changed files. If you are not
happy yet, answer `r` or `e` with what should change: the coder and tester work on it in
another iteration, and the reviewer checks that your feedback was addressed. These
iterations do not count towards `loop.maxIterations`.

With `loop.onLimit: ask`, conductor also asks at a limit whether to continue with
another budget, finish as a draft or abort.

### Gates on the pull request

`--gates` decides **where** you answer a gate. By default (`--gates terminal`)
conductor asks in the terminal and continues as soon as you type `a`. With
`--gates pr`, you answer on the pull request instead, and conductor exits while it
waits:

```text
$ conductor run --gates pr "Add CSV export"
…
<run-id> waiting_for_gate conductor/<run-id>-add-csv-export
Continue with: conductor resume --gates pr <run-id>
```

The draft pull request now shows the document to review. On the pull request:

- **Approve** it, or add the label `conductor:approved` (`github.labels.approved`),
  to continue. conductor removes the label again.
- **Request changes** to revise. Your review text and all comments since the gate
  opened become the feedback.

Then run `conductor resume --gates pr <run-id>`. Without a new review, the run keeps
waiting.

This is how gates will work in GitHub Actions (phase 4), where there is no terminal and
a workflow runs `resume` for you. Locally, `--gates pr` lets you try that flow or hand
the review to a colleague; for everyday local runs you do not need it. Only reviews and comments from people with write access count,
and only those after the gate opened. At a limit, `loop.onLimit: ask` finishes as a
draft, because nobody can answer in the terminal.

### Writing feedback in the editor

With `e`, conductor creates a temporary file `FEEDBACK.md` and opens it in your editor:

1. The editor command is taken from `$VISUAL`, then `$EDITOR`; without either, `vi`
   is used. The file path is appended to the command.
2. The file starts with comment lines that name the document and the gate. Write your
   feedback below them; it can span several lines and use Markdown.
3. Save the file and close the editor. conductor waits until the editor exits, removes
   all lines starting with `#` and uses the rest as feedback.
4. If the remaining text is empty, or the editor exits with an error, nothing is sent
   and conductor asks again.

The editor must block until you close the file. Terminal editors such as `vi` or `nano`
do this; for VS Code, use `--wait`:

```bash
export EDITOR="code --wait"
```

## Changing a finished result

If you are not happy with a finished run (`done` or `needs_human`), give feedback instead
of starting over:

```bash
git switch conductor/<run-id>-<slug>   # the run's branch, with a clean working tree
conductor revise <run-id> "Print the date in ISO format and add a --help flag"
```

conductor moves the run back from the archive, gives your feedback to the coder and runs
coder, tester, checks and reviewer again; the reviewer checks that your feedback was
addressed. The iteration limit and the cost and time budgets start afresh. At the end,
the branch again has exactly one commit, containing the earlier and the new changes;
without `--no-pr`, conductor force-pushes it and updates the pull request.
Run `revise` as often as you like.

To give feedback before a run finishes, enable the final gate (`gates.final: true`, see
[Gates](#gates)).

## Interrupting and resuming

The run state is saved in `.conductor/runs/<run-id>/` after every step. Press Ctrl-C at
any time; `conductor resume <run-id>` (with the same `--no-pr` or `--gates` options)
repeats the interrupted step and
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
