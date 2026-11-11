import type { Config } from "../schemas/config.js";
import type { Route } from "../schemas/role.js";
import type { RunState, Step } from "../schemas/state.js";
import type { Finding } from "../schemas/verdict.js";

/** Starts the review loop with both coder and tester. */
export function enterLoop(state: RunState): RunState {
  return {
    ...state,
    step: "coder",
    iteration: 1,
    route: "both",
    findings: [],
    violations: [],
  };
}

export function afterProductOwner(config: Config, state: RunState): RunState {
  return { ...state, step: config.gates.po ? "po_gate" : "planner" };
}

export function afterPlanner(config: Config, state: RunState): RunState {
  return config.gates.planner
    ? { ...state, step: "planner_gate" }
    : enterLoop(state);
}

export function stepAfterCoder(route: Route): Step {
  return route === "coder" ? "checks" : "tester";
}

/** Starts the next iteration with the roles the reviewer asked for. */
export function nextIteration(
  state: RunState,
  route: Route,
  findings: readonly Finding[],
): RunState {
  return {
    ...state,
    step: route === "tester" ? "tester" : "coder",
    iteration: state.iteration + 1,
    route,
    findings: [...findings],
    violations: [],
  };
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
 * Starts an iteration for coder and tester with a human's feedback. It does not
 * count toward the iteration limit.
 */
export function startHumanIteration(
  state: RunState,
  feedback: string,
): RunState {
  const finding = humanFinding(feedback, state.iteration + 1);
  return {
    ...nextIteration(state, "both", [finding]),
    humanIterations: state.humanIterations + 1,
  };
}
