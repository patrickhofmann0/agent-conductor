# 0012. OpenCode V2 through @opencode/client and a private server

- Status: accepted
- Date: 2026-11-06
- Plan references: D5, D6, D25, D29; supersedes the client choice in [ADR 0003](0003-opencode-sdk-and-server.md)

## Context

ADR 0003 chose "the official TypeScript SDK and `opencode serve`" while OpenCode V2 was
already in use locally. V2 replaced the package family and the server API:

| Package            | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `@opencode/client` | Generated, typed client for the V2 HTTP API (light)                 |
| `@opencode/sdk`    | Embeds the whole OpenCode server in-process (heavy, native modules) |
| `@opencode/cli`    | The `opencode` binary, installable via npm                          |

The former `@opencode-ai/sdk` and `opencode-ai` packages and the `curl opencode.ai/install`
script still deliver V1.

V2 also changed the permission model to ordered rules `{ action, resource, effect }`
where the last match wins, and lets `session.create` take a ruleset, a model and a
directory. Session routes are marked experimental.

## Decision

- Use OpenCode V2, with every `@opencode/*` package pinned to the same exact version
  (2.2.5).
- conductor starts a **private server per run** (`opencode serve --hostname 127.0.0.1
--port <free port>`) and talks to it through the Promise entry point of
  `@opencode/client`. It does not use the user's shared background service.
- The `opencode` binary comes from `@opencode/cli`, installed in the devcontainer and in
  CI.
- Each agent run creates its own session with the built-in `build` agent, the role's
  model and the role's permission ruleset. Role instructions are sent at the start of the
  prompt text. Only documented API is used; in particular no `OPENCODE_CONFIG_CONTENT`.
- `conductor.yaml` adopts the V2 permission vocabulary: `roles.<role>.permissions` is a
  list of rules appended to the role defaults. `ask` is not accepted.
- Fixed rules are appended last to every session and cannot be overridden: deny
  `shell git *` and `shell gh *`, `subagent *` (subagents do not inherit the session's
  rules), `question *` (nobody can answer), `read *.env` and `read *.env.*`, and
  `external_directory *`.
- If OpenCode still asks for a permission, the adapter rejects it and reports it.

## Consequences

- conductor's npm package stays small and runs on plain Node.js; users run the same
  OpenCode version locally and in CI.
- Process management (port, startup, shutdown) is conductor's job.
- Role instructions are part of the user message rather than the system prompt. The
  `build` agent's own system prompt still applies, which keeps OpenCode's tool guidance.
- The experimental session API may change between versions. Exact pins and contract tests
  in the adapter make changes visible on upgrade.

## Alternatives considered

- `@opencode/sdk` embedded – clean plugin-based agents and policies, but adds about
  17 MB plus native modules to conductor and fixes the OpenCode version.
- The shared background service via `Service.ensure()` – not isolated, harder in CI.
- Agents and policies via `OPENCODE_CONFIG_CONTENT` – undocumented.
- Writing agent files into the target repository – pollutes the repository.
- Keeping the V1 permission vocabulary (`edit`/`bash`/`webfetch`) – a translation layer
  for a format nobody uses yet.
