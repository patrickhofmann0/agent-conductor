# 0003. OpenCode as agent harness via SDK and server

- Status: accepted; client choice and permission handling superseded by [ADR 0012](0012-opencode-v2-client-and-private-server.md)
- Date: 2026-11-06
- Plan references: D5, D6, D24, D25

## Context

The framework must not implement its own LLM client. OpenCode already provides
agents, tools, permissions, providers and cost tracking, and can run headless as a
server.

## Decision

- conductor starts `opencode serve` as a child process on a free port and talks to it
  through the official TypeScript SDK. Each pipeline phase runs in its own session.
- Roles are defined in `conductor.yaml` (prompt, model, permissions) with built-in
  defaults. Role prompts are English; the language of produced artifacts is
  configurable.
- Models: one default model, overridable per role.
- Providers are configured through OpenCode. Supported targets: OpenAI (local + CI),
  GitHub Copilot (local only, its OAuth token is not suitable for CI). Others work if
  OpenCode supports them.
- All OpenCode access lives in `src/adapters/opencode/` behind the `AgentRunner` port.

## Consequences

- Structured results, streaming events and per-session cost data are available.
- conductor depends on the OpenCode server API. The SDK version is pinned and the
  adapter kept thin.
- Open point for Phase 2: the locally installed OpenCode is v2.x while
  `@opencode-ai/sdk` is at 1.19.x and new packages exist (`@opencode-ai/client`). The
  correct client package must be determined before implementing the adapter.

## Alternatives considered

- `opencode run` per phase via CLI – simpler, but results only via stdout/files, no
  structured events, a process start per phase.
- Native OpenCode agent files (`.opencode/agent/*.md`) – would spread configuration
  across two places in target repos.
