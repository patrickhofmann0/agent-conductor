import { handleLimit } from "./on-limit.js";
import { roleSettings } from "../roles/settings.js";

import type { EngineContext } from "./engine.types.js";
import type { AgentRunResult } from "../ports/agent-runner.types.js";
import type { Role } from "../schemas/role.js";
import type { RunState } from "../schemas/state.js";

export interface AgentStepRequest {
  readonly role: Role;
  readonly prompt: string;
  /** Continue an earlier session, e.g. to ask the reviewer for a corrected answer. */
  readonly sessionId?: string;
}

export type AgentStepOutcome =
  | {
      readonly kind: "completed";
      readonly state: RunState;
      readonly output: string;
      readonly sessionId: string;
    }
  /** The run stopped or the limit handling decided what happens next. */
  | { readonly kind: "stopped"; readonly state: RunState };

function record(state: RunState, result: AgentRunResult): RunState {
  return {
    ...state,
    costUsd: state.costUsd + result.costUsd,
    history: [
      ...state.history,
      {
        step: state.step,
        iteration: state.iteration,
        sessionId: result.sessionId,
        status: result.status,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
      },
    ],
  };
}

function failureDetail(role: Role, result: AgentRunResult): string {
  const reason = result.error === undefined ? "." : `: ${result.error}`;
  return `The ${role} agent did not finish (${result.status})${reason}`;
}

/**
 * Runs one agent session and verifies afterwards that version control was not
 * touched (ADR 0006). Records cost and history in the returned state.
 */
export async function runAgentStep(
  ctx: EngineContext,
  state: RunState,
  request: AgentStepRequest,
): Promise<AgentStepOutcome> {
  const { deps, config } = ctx;
  const before = await deps.vcs.integritySnapshot();
  const result = await deps.agents.run({
    ...roleSettings(config, request.role),
    ...request,
    timeoutMs: config.limits.phaseTimeout,
  });
  const after = await deps.vcs.integritySnapshot();
  const recorded = record(state, result);
  deps.reporter.report({
    type: "agent_finished",
    step: state.step,
    iteration: state.iteration,
    costUsd: result.costUsd,
    durationMs: result.durationMs,
  });
  if (after !== before) {
    const outcome = `Version control was modified during the ${request.role} phase. The run was stopped because an agent may have bypassed the framework.`;
    return {
      kind: "stopped",
      state: { ...recorded, status: "failed", outcome },
    };
  }
  if (result.status !== "completed") {
    const breach = {
      kind: "phase_failed" as const,
      detail: failureDetail(request.role, result),
    };
    return {
      kind: "stopped",
      state: await handleLimit(ctx, { state: recorded, breach }),
    };
  }
  return {
    kind: "completed",
    state: recorded,
    output: result.output,
    sessionId: result.sessionId,
  };
}
