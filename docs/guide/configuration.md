# Configuration reference

conductor reads `conductor.yaml` from the root of your repository. Every setting is
optional; without the file, the defaults below apply.

Point your editor at the JSON schema for completion and validation:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/patrickhofmann0/agent-conductor/main/conductor.schema.json
```

Durations are written as `90s`, `20m`, `2h` or combinations like `1h30m`.

## Example

```yaml
version: 1
language: de

models:
  default: openai/gpt-5
  reviewer: openai/o3

gates:
  po: true
  planner: true

loop:
  maxIterations: 3
  onLimit: draft_pr

limits:
  phaseTimeout: 20m
  totalTimeout: 2h
  maxCostUsd: 10

checks:
  - name: test
    command: npm test
  - name: lint
    command: npm run lint
    required: false

guardrails:
  paths:
    - "**/*.test.ts"
    - "eslint.config.*"
    - ".github/workflows/**"

roles:
  coder:
    prompt: Use the existing logger in src/log.ts for all output.
```

## Reference

### General

| Key        | Default | Description                                                                                      |
| ---------- | ------- | ------------------------------------------------------------------------------------------------ |
| `$schema`  | –       | Optional JSON schema reference for editors. Ignored by conductor.                                |
| `version`  | `1`     | Configuration format version. Only `1` exists.                                                   |
| `language` | `en`    | Language of documents, findings and pull request text, e.g. `de` or `pt-BR`. Code stays English. |

### Models

Models are written as `provider/model`, optionally with a variant such as
`openai/gpt-5#high`, as configured in OpenCode. Without any model, OpenCode's default
model is used.

| Key               | Default          | Description                                |
| ----------------- | ---------------- | ------------------------------------------ |
| `models.default`  | OpenCode default | Model for every role without its own model |
| `models.po`       | `models.default` | Model for the product owner                |
| `models.planner`  | `models.default` | Model for the planner                      |
| `models.coder`    | `models.default` | Model for the coder                        |
| `models.tester`   | `models.default` | Model for the tester                       |
| `models.reviewer` | `models.default` | Model for the reviewer                     |

### Gates

| Key             | Default | Description                                  |
| --------------- | ------- | -------------------------------------------- |
| `gates.po`      | `true`  | Pause for human approval of the requirements |
| `gates.planner` | `true`  | Pause for human approval of the plan         |

### Review loop

| Key                  | Default    | Description                                                                                 |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `loop.maxIterations` | `3`        | Review rounds without approval before the limit applies (1–20)                              |
| `loop.onLimit`       | `draft_pr` | What happens at any limit: `draft_pr`, `fail` or `ask` (see [concepts](concepts.md#limits)) |

### Limits

| Key                   | Default | Description                                              |
| --------------------- | ------- | -------------------------------------------------------- |
| `limits.phaseTimeout` | `20m`   | Maximum duration of one agent session                    |
| `limits.totalTimeout` | `2h`    | Maximum working time of the run, excluding time at gates |
| `limits.maxCostUsd`   | `10`    | Maximum model cost in US dollars                         |

### Checks

Shell commands conductor runs after the tester, in the given order. Their results go to
the reviewer. A failing **required** check prevents approval.

| Key                 | Default | Description                                                 |
| ------------------- | ------- | ----------------------------------------------------------- |
| `checks[].name`     | –       | Unique name: lowercase letters, digits and dashes           |
| `checks[].command`  | –       | Shell command, run from the repository root                 |
| `checks[].required` | `true`  | Whether the check must pass before the reviewer may approve |
| `checks[].timeout`  | `10m`   | Maximum duration of the command                             |

### Guardrails

| Key                | Default | Description                                                                                                                     |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `guardrails.paths` | `[]`    | Globs of files the coder must not change, such as tests and lint configs. Files the tester changes are protected automatically. |

Globs match paths relative to the repository root and support `**`, `*`, `?` and
`{a,b}`.

### Git

| Key                 | Default           | Description                                                            |
| ------------------- | ----------------- | ---------------------------------------------------------------------- |
| `git.baseBranch`    | `main`            | Branch the run branch is created from                                  |
| `git.branchPrefix`  | `conductor/`      | Prefix of run branches                                                 |
| `git.commitMessage` | `feat: {{title}}` | Message of the final squashed commit; `{{title}}` is the request title |

### GitHub

| Key                        | Default                 | Description                             |
| -------------------------- | ----------------------- | --------------------------------------- |
| `github.labels.trigger`    | `conductor`             | Issue label that starts a run           |
| `github.labels.approved`   | `conductor:approved`    | Pull request label that approves a gate |
| `github.labels.needsHuman` | `conductor:needs-human` | Label added when a run stops at a limit |

### Roles

Per-role settings under `roles.<role>`, where `<role>` is `po`, `planner`, `coder`,
`tester` or `reviewer`.

| Key                                   | Default  | Description                                                                       |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `roles.<role>.prompt`                 | –        | Project-specific instructions for the role                                        |
| `roles.<role>.promptMode`             | `append` | `append` adds the prompt to the built-in instructions, `replace` replaces them    |
| `roles.<role>.permissions`            | `[]`     | Ordered OpenCode permission rules added to the role's defaults                    |
| `roles.<role>.permissions[].action`   | –        | OpenCode permission action, e.g. `shell`, `edit`, `read`, `webfetch`              |
| `roles.<role>.permissions[].resource` | –        | Command, path or URL pattern; `*` matches anything                                |
| `roles.<role>.permissions[].effect`   | –        | `allow` or `deny`. `ask` is not supported, because nobody can answer during a run |

Permissions use [OpenCode's permission rules](https://opencode.ai/docs/permissions/):
the last matching rule wins. For each agent, conductor combines three lists in this
order:

1. **Role defaults:**

   | Role              | `edit`  | `shell` | `webfetch`, `websearch` |
   | ----------------- | ------- | ------- | ----------------------- |
   | `po`, `planner`   | `deny`  | `deny`  | `allow`                 |
   | `coder`, `tester` | `allow` | `allow` | `deny`                  |
   | `reviewer`        | `deny`  | `deny`  | `deny`                  |

2. **Your rules** from `roles.<role>.permissions`.
3. **Fixed rules** that you cannot override: no `git` or `gh` commands, no subagents
   (they would not inherit these rules), no questions to a human, no reading `.env`
   files, and no access outside the repository.

Example: let the reviewer run the tests, and keep the coder away from the database
migrations:

```yaml
roles:
  reviewer:
    permissions:
      - { action: shell, resource: "npm test *", effect: allow }
  coder:
    permissions:
      - { action: edit, resource: "db/migrations/*", effect: deny }
```
