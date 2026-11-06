import { reviewerRetryTask } from "../../prompts/tasks.js";
import { parseVerdict } from "../../review/parse-verdict.js";
import { runAgentStep, type AgentStepRequest } from "../agent-step.js";
import { handleLimit } from "../on-limit.js";

import type { EngineContext } from "../engine.types.js";
import type { RunState } from "../../schemas/state.js";
import type { Verdict } from "../../schemas/verdict.js";

/** One first answer plus two corrections. */
export const MAX_REVIEW_ATTEMPTS = 3;

export type VerdictOutcome =
  | {
      readonly kind: "verdict";
      readonly state: RunState;
      readonly verdict: Verdict;
    }
  | { readonly kind: "stopped"; readonly state: RunState };

/**
 * Asks the reviewer for a verdict. An unusable answer is sent back in the same
 * session with the problem described; after the last attempt the phase fails.
 */
export async function obtainVerdict(
  ctx: EngineContext,
  state: RunState,
  prompt: string,
): Promise<VerdictOutcome> {
  let current = state;
  let request: AgentStepRequest = { role: "reviewer", prompt };
  let problem = "";
  for (let attempt = 1; attempt <= MAX_REVIEW_ATTEMPTS; attempt += 1) {
    const outcome = await runAgentStep(ctx, current, request);
    if (outcome.kind === "stopped") return outcome;
    const parsed = parseVerdict(outcome.output);
    if (parsed.ok)
      return { kind: "verdict", state: outcome.state, verdict: parsed.verdict };
    current = outcome.state;
    problem = parsed.error;
    request = {
      role: "reviewer",
      prompt: reviewerRetryTask(problem),
      sessionId: outcome.sessionId,
    };
  }
  const detail = `The reviewer gave no valid verdict after ${String(MAX_REVIEW_ATTEMPTS)} attempts. Last problem: ${problem}`;
  return {
    kind: "stopped",
    state: await handleLimit(ctx, {
      state: current,
      breach: { kind: "phase_failed", detail },
    }),
  };
}
