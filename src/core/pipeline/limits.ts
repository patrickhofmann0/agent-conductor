import type { LimitKind } from "../ports/gate-handler.types.js";
import type { Config } from "../schemas/config.js";
import type { RunState } from "../schemas/state.js";

export interface LimitBreach {
  readonly kind: LimitKind;
  readonly detail: string;
}

/** Each human "continue" at a limit grants another budget of the same size. */
function budgetFactor(state: RunState): number {
  return 1 + state.extensions;
}

function minutes(ms: number): string {
  return `${String(Math.round(ms / 60_000))} min`;
}

/** Checks the cost and active-time budgets, counted since the last `revise`. */
export function budgetBreach(
  config: Config,
  state: RunState,
): LimitBreach | null {
  const factor = budgetFactor(state);
  const cost = state.costUsd - state.costOffsetUsd;
  const maxCost = config.limits.maxCostUsd * factor;
  if (cost >= maxCost) {
    return {
      kind: "cost",
      detail: `Cost limit reached: $${cost.toFixed(2)} of $${maxCost.toFixed(2)}.`,
    };
  }
  const activeMs = state.activeMs - state.activeOffsetMs;
  const maxTime = config.limits.totalTimeout * factor;
  if (activeMs >= maxTime) {
    return {
      kind: "time",
      detail: `Time limit reached: ${minutes(activeMs)} of ${minutes(maxTime)}.`,
    };
  }
  return null;
}

/**
 * True when the review loop may not start another iteration. Iterations
 * started by human feedback do not count.
 */
export function iterationBreach(
  config: Config,
  state: RunState,
): LimitBreach | null {
  const maxIterations = config.loop.maxIterations * budgetFactor(state);
  const rounds = state.iteration - state.humanIterations;
  if (rounds < maxIterations) return null;
  return {
    kind: "iterations",
    detail: `Iteration limit reached: ${String(rounds)} of ${String(maxIterations)} review rounds without approval.`,
  };
}
