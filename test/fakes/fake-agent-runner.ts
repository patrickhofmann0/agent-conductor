import type { FakeClock } from "./fake-clock.js";
import type {
  AgentRunner,
  AgentRunRequest,
  AgentRunResult,
  AgentRunStatus,
} from "../../src/core/ports/agent-runner.types.js";
import type { Role } from "../../src/core/schemas/role.js";

export interface ScriptedRun {
  readonly output?: string;
  readonly status?: AgentRunStatus;
  readonly costUsd?: number;
  readonly durationMs?: number;
  /** Simulates what the agent does while working, e.g. changing files. */
  readonly effect?: () => void;
}

export const APPROVE_JSON =
  '```json\n{"verdict":"approve","route":"both","summary":"All criteria met.","findings":[]}\n```';

const DEFAULT_OUTPUT: Readonly<Record<Role, string>> = {
  po: "# Requirements\n\n1. Export CSV",
  planner: "# Plan\n\n1. Add exporter",
  coder: "Implemented the exporter.",
  tester: "Added tests.",
  reviewer: APPROVE_JSON,
};

/** Answers agent runs from per-role scripts, falling back to sensible defaults. */
export class FakeAgentRunner implements AgentRunner {
  readonly requests: AgentRunRequest[] = [];
  private readonly scripts = new Map<Role, ScriptedRun[]>();
  private sessions = 0;

  constructor(private readonly clock: FakeClock) {}

  script(role: Role, ...runs: ScriptedRun[]): this {
    this.scripts.set(role, [...(this.scripts.get(role) ?? []), ...runs]);
    return this;
  }

  requestsFor(role: Role): AgentRunRequest[] {
    return this.requests.filter((request) => request.role === role);
  }

  run(request: AgentRunRequest): Promise<AgentRunResult> {
    this.requests.push(request);
    const scripted = this.scripts.get(request.role)?.shift() ?? {};
    scripted.effect?.();
    const durationMs = scripted.durationMs ?? 1_000;
    this.clock.advance(durationMs);
    this.sessions += 1;
    return Promise.resolve({
      sessionId: request.sessionId ?? `session-${String(this.sessions)}`,
      status: scripted.status ?? "completed",
      output: scripted.output ?? DEFAULT_OUTPUT[request.role],
      costUsd: scripted.costUsd ?? 0.1,
      durationMs,
    });
  }
}
