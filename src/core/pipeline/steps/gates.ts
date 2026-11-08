import { PLAN, REQUIREMENTS, requireArtifact } from "./artifacts.js";
import { formatCheckResults } from "../../prompts/format.js";
import { renderGateBody } from "../pr-body.js";
import { enterLoop, nextIteration } from "../transitions.js";

import type { EngineContext, StepHandler } from "../engine.types.js";
import type { GateDecision, GateName } from "../../ports/gate-handler.types.js";
import type { RunState } from "../../schemas/state.js";
import type { Finding } from "../../schemas/verdict.js";

interface GateSpec {
  readonly gate: GateName;
  /** Name of what the human reviews, e.g. "requirements.md". */
  readonly artifact: string;
  readonly content: (ctx: EngineContext, state: RunState) => Promise<string>;
  readonly approve: (state: RunState) => RunState;
  /** Applies the human's change request. */
  readonly revise: (state: RunState, feedback: string) => RunState;
}

function applyDecision(
  spec: GateSpec,
  state: RunState,
  decision: GateDecision,
): RunState {
  switch (decision.kind) {
    case "approve":
      return spec.approve({ ...state, outcome: null });
    case "revise":
      return spec.revise({ ...state, outcome: null }, decision.feedback);
    case "abort":
      return { ...state, status: "aborted", outcome: decision.reason };
    case "pending":
      return {
        ...state,
        status: "waiting_for_gate",
        outcome: `Waiting for a human to approve ${spec.artifact}.`,
      };
  }
}

function createGateStep(spec: GateSpec): StepHandler {
  return async (ctx, state) => {
    const artifact = await spec.content(ctx, state);
    await ctx.deps.publisher.publish({
      runId: state.runId,
      stage: "gate",
      title: state.input.title,
      body: renderGateBody(spec.artifact, artifact),
    });
    const decision = await ctx.deps.gates.request({
      runId: state.runId,
      gate: spec.gate,
      artifactName: spec.artifact,
      artifact,
    });
    return applyDecision(spec, state, decision);
  };
}

function documentContent(
  name: string,
): (ctx: EngineContext, state: RunState) => Promise<string> {
  return (ctx, state) => requireArtifact(ctx, state, name);
}

export const productOwnerGateStep = createGateStep({
  gate: "po",
  artifact: REQUIREMENTS,
  content: documentContent(REQUIREMENTS),
  approve: (state) => ({ ...state, step: "planner" }),
  revise: (state, feedback) => ({
    ...state,
    step: "po",
    gateFeedback: feedback,
  }),
});

export const plannerGateStep = createGateStep({
  gate: "planner",
  artifact: PLAN,
  content: documentContent(PLAN),
  approve: enterLoop,
  revise: (state, feedback) => ({
    ...state,
    step: "planner",
    gateFeedback: feedback,
  }),
});

const FINAL_SUMMARY = "summary.md";

async function finalSummary(
  ctx: EngineContext,
  state: RunState,
): Promise<string> {
  const changed = await ctx.deps.vcs.changedFiles(state.baseCommit);
  const files =
    changed.length === 0 ? "None." : changed.map((f) => `- ${f}`).join("\n");
  return [
    "# Result",
    `## Review (iteration ${String(state.iteration)})`,
    state.lastVerdict?.summary ?? "No review yet.",
    "## Checks",
    formatCheckResults(state.checkResults),
    "## Changed files",
    files,
  ].join("\n\n");
}

/** The human's change request, routed to the coder like a review finding. */
function humanFinding(feedback: string, iteration: number): Finding {
  return {
    id: `human-feedback-${String(iteration)}`,
    severity: "high",
    target: "coder",
    message: feedback,
    source: "human",
  };
}

/**
 * Lets a human accept the approved result or ask for another iteration
 * (phase 2b). Iterations started here do not count toward the limit.
 */
export const finalGateStep = createGateStep({
  gate: "final",
  artifact: FINAL_SUMMARY,
  content: finalSummary,
  approve: (state) => ({ ...state, step: "finalize" }),
  revise: (state, feedback) => ({
    ...nextIteration(state, "both", [
      humanFinding(feedback, state.iteration + 1),
    ]),
    humanIterations: state.humanIterations + 1,
  }),
});
