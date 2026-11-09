import { createRunState } from "./create-state.js";
import { budgetBreach } from "./limits.js";
import { branchName } from "./naming.js";
import { handleLimit } from "./on-limit.js";
import { startHumanIteration } from "./transitions.js";
import { plannerStep, productOwnerStep } from "./steps/documents.js";
import { finalizeStep } from "./steps/finalize.js";
import {
  finalGateStep,
  plannerGateStep,
  productOwnerGateStep,
} from "./steps/gates.js";
import { checksStep, coderStep, testerStep } from "./steps/implementation.js";
import { reviewStep } from "./steps/review.js";

import type { EngineContext, StepHandler } from "./engine.types.js";
import type { RunInput, RunState, Step } from "../schemas/state.js";

const HANDLERS: Readonly<Record<Step, StepHandler>> = {
  po: productOwnerStep,
  po_gate: productOwnerGateStep,
  planner: plannerStep,
  planner_gate: plannerGateStep,
  coder: coderStep,
  tester: testerStep,
  checks: checksStep,
  review: reviewStep,
  final_gate: finalGateStep,
  finalize: finalizeStep,
};

/** Steps that wait for humans or wrap up; they neither use nor count budget. */
const UNBUDGETED: ReadonlySet<Step> = new Set<Step>([
  "po_gate",
  "planner_gate",
  "final_gate",
  "finalize",
]);

async function advance(ctx: EngineContext, state: RunState): Promise<RunState> {
  const budgeted = !UNBUDGETED.has(state.step);
  const breach = budgeted ? budgetBreach(ctx.config, state) : null;
  if (breach !== null) return handleLimit(ctx, { state, breach });
  ctx.deps.reporter.report({
    type: "step_started",
    step: state.step,
    iteration: state.iteration,
  });
  const started = ctx.deps.clock.now();
  const next = await HANDLERS[state.step](ctx, state);
  if (!budgeted) return next;
  return { ...next, activeMs: next.activeMs + ctx.deps.clock.now() - started };
}

function reportEnd(ctx: EngineContext, state: RunState): void {
  const reason = state.outcome ?? "";
  if (state.status === "waiting_for_gate") {
    ctx.deps.reporter.report({ type: "run_paused", reason });
    return;
  }
  ctx.deps.reporter.report({
    type: "run_finished",
    status: state.status,
    reason,
  });
}

/** Executes steps until the run finishes, fails or waits for a human. */
export async function runPipeline(
  ctx: EngineContext,
  initial: RunState,
): Promise<RunState> {
  let state = initial;
  while (state.status === "running") {
    state = await advance(ctx, state);
    await ctx.deps.store.saveState(state);
  }
  reportEnd(ctx, state);
  return state;
}

export interface StartRunOptions {
  readonly runId: string;
  readonly input: RunInput;
}

/** Creates the branch and runs a new pipeline from the product owner on. */
export async function startRun(
  ctx: EngineContext,
  options: StartRunOptions,
): Promise<RunState> {
  const { deps, config } = ctx;
  const branch = branchName(
    config.git.branchPrefix,
    options.runId,
    options.input.title,
  );
  const baseCommit = await deps.vcs.createBranch(branch, config.git.baseBranch);
  const state = createRunState({
    ...options,
    branch,
    baseCommit,
    startedAt: deps.clock.now(),
  });
  await deps.store.saveState(state);
  return runPipeline(ctx, state);
}

/**
 * Continues a run that waits at a gate or was interrupted. Finished runs are
 * returned unchanged.
 */
export async function resumeRun(
  ctx: EngineContext,
  runId: string,
): Promise<RunState> {
  const state = await ctx.deps.store.loadState(runId);
  if (state.status === "waiting_for_gate") {
    return runPipeline(ctx, { ...state, status: "running", outcome: null });
  }
  if (state.status === "running") return runPipeline(ctx, state);
  return state;
}

const REVISABLE: ReadonlySet<RunState["status"]> = new Set<RunState["status"]>([
  "done",
  "needs_human",
]);

/**
 * Reopens a finished run with human feedback (phase 2b): coder and tester work
 * on it, and the iteration limit and the cost and time budgets start afresh.
 */
export async function reviseRun(
  ctx: EngineContext,
  runId: string,
  feedback: string,
): Promise<RunState> {
  const state = await ctx.deps.store.loadState(runId);
  if (!REVISABLE.has(state.status)) {
    throw new Error(
      `Run ${runId} is ${state.status}; only finished runs (done or needs_human) can be revised. Use resume instead.`,
    );
  }
  await ctx.deps.store.restore(runId);
  const next = startHumanIteration(state, feedback);
  const reopened: RunState = {
    ...next,
    status: "running",
    outcome: null,
    needsHuman: false,
    humanIterations: next.iteration,
    costOffsetUsd: state.costUsd,
    activeOffsetMs: state.activeMs,
  };
  await ctx.deps.store.saveState(reopened);
  return runPipeline(ctx, reopened);
}
