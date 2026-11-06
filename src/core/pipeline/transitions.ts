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
