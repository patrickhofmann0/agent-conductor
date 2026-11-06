# Working with agents

This repository is built to be developed with AI coding agents (for example through
OpenCode with Claude Sonnet). The guardrails catch most mistakes automatically, but how
you hand out work still decides how much rework you get. This page collects what works.

## How agents learn the rules

- [AGENTS.md](../../AGENTS.md) is loaded automatically by OpenCode and most other agent
  harnesses. It is the condensed rule set. Keep it short; details belong here in
  `docs/contributing/`.
- `bun run verify` is the single source of truth. Tell the agent that a task is only
  done when it passes.
- ADRs in `docs/adr/` explain decisions so agents do not "fix" them.

## Cut work into small tasks

One task per session, finished with a green `verify` and a commit. Good tasks are:

- **Small:** a single module plus its tests, or a single adapter method.
- **Specified:** inputs, outputs, error cases and the relevant plan section or ADR.
- **Verifiable:** acceptance criteria that tests can express.

| Too big                      | Better                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| "Implement phase 1"          | "Add the zod schema for `conductor.yaml` as described in PLAN.md chapter 6, with tests" |
| "Build the OpenCode adapter" | "Implement `AgentRunner.run` for a single session without permissions; see ADR 0003"    |
| "Add GitHub support"         | "Add `Forge.getIssue` using Octokit, tested against recorded responses"                 |

## Prompt template

```text
Task: <one sentence>

Context:
- Plan: docs/PLAN.md section <x>
- Decisions: docs/adr/<nnnn>
- Related code: <paths>

Requirements:
- <behavior 1>
- <behavior 2>
- Error handling: <cases>

Acceptance criteria:
- <testable statement>
- `bun run verify` passes.

Constraints:
- Do not modify guardrail files (see AGENTS.md). If a guardrail blocks you, stop and
  explain why instead of working around it.
- Look up library APIs in node_modules/**/*.d.ts or the official docs.
```

## Use up-to-date documentation

Models often remember outdated APIs. This matters most for OpenCode (the SDK and server
API change quickly), ESLint flat config, Stryker, Vitest and GitHub Actions. Ask the
agent to read the type definitions in `node_modules` or fetch the official docs before
writing integration code.

## Choosing models

A practical split:

- **Design and review** — state machine design, port interfaces, the OpenCode adapter,
  reviewing larger changes: use a strong model.
- **Implementation** of well-specified tasks: a fast model such as Sonnet works well,
  because the guardrails catch the typical mistakes.

## Reviewing agent work

Check in this order:

1. **Did it touch guardrails?** Look for changes to any guardrail file (see
   [guardrails](guardrails.md#guardrail-protection)), new `eslint-disable` comments,
   `@ts-expect-error`, `.skip`. CI blocks most of this, but look anyway.
2. **Do the tests test anything?** Read the assertions. Run `bun run mutation` for
   changes to core logic.
3. **Is the code in the right layer?** Decisions in core, I/O in adapters
   ([architecture](architecture.md)).
4. **Did it invent APIs?** Especially for OpenCode, Octokit and Node APIs.
5. **Is there a decision without an ADR?**
6. **Is the documentation updated?**

## Typical agent failure modes

| Failure mode                                  | What catches it                   |
| --------------------------------------------- | --------------------------------- |
| Casting or `any` to silence the type checker  | ESLint                            |
| Weakening a check to get green                | Guardrail protection, code owners |
| Tests that run code but assert nothing useful | `expect-expect`, mutation testing |
| Huge functions that do everything             | Size and complexity limits        |
| Importing an adapter from core                | dependency-cruiser                |
| Leftover helpers and exports                  | knip                              |
| Using Bun APIs that break on Node             | ESLint, Node smoke test           |
| Hallucinated library APIs                     | Type checker, tests               |
| Committing with `--no-verify`                 | CI runs the same checks           |
| Scope creep: refactoring unrelated code       | Your review; keep tasks small     |
| Silently changing a documented decision       | Your review; ADRs                 |

## When an agent gets stuck

If the agent loops on a failing guardrail, stop it. Usually either the task is too big
(split it), the specification is unclear (add examples), or the guardrail is genuinely
wrong — in that case a human changes it in a separate pull request (see
[changing a guardrail](guardrails.md#changing-a-guardrail)).
