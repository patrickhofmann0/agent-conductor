import { PLAN, REQUIREMENTS, requireArtifact } from "./artifacts.js";
import { renderGateBody } from "../pr-body.js";
import { enterLoop } from "../transitions.js";

import type { StepHandler } from "../engine.types.js";
import type { GateDecision, GateName } from "../../ports/gate-handler.types.js";
import type { RunState, Step } from "../../schemas/state.js";

interface GateSpec {
  readonly gate: GateName;
  readonly artifact: string;
  /** Step that is repeated when a human asks for changes. */
  readonly revise: Step;
  readonly approve: (state: RunState) => RunState;
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
      return {
        ...state,
        step: spec.revise,
        gateFeedback: decision.feedback,
        outcome: null,
      };
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
    const artifact = await requireArtifact(ctx, state, spec.artifact);
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

export const productOwnerGateStep = createGateStep({
  gate: "po",
  artifact: REQUIREMENTS,
  revise: "po",
  approve: (state) => ({ ...state, step: "planner" }),
});

export const plannerGateStep = createGateStep({
  gate: "planner",
  artifact: PLAN,
  revise: "planner",
  approve: enterLoop,
});
