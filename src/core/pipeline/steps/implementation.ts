import { loadImplementationInput } from "./artifacts.js";
import { revertViolations } from "./protect.js";
import { coderTask, testerTask } from "../../prompts/tasks.js";
import { runAgentStep } from "../agent-step.js";
import { stepAfterCoder } from "../transitions.js";

import type { StepHandler } from "../engine.types.js";
import type { CheckResult } from "../../schemas/check-result.js";

export const coderStep: StepHandler = async (ctx, state) => {
  const before = await ctx.deps.vcs.head();
  const prompt = coderTask(await loadImplementationInput(ctx, state));
  const outcome = await runAgentStep(ctx, state, { role: "coder", prompt });
  const guarded = await revertViolations(ctx, outcome.state, {
    before,
    target: "coder",
    patterns: ctx.config.guardrails.paths,
    testerPaths: state.testerPaths,
  });
  if (outcome.kind === "stopped") return guarded;
  await ctx.deps.vcs.commit(
    `chore(conductor): coder iteration ${String(state.iteration)}`,
  );
  return { ...guarded, step: stepAfterCoder(state.route) };
};

export const testerStep: StepHandler = async (ctx, state) => {
  const before = await ctx.deps.vcs.head();
  const prompt = testerTask(await loadImplementationInput(ctx, state));
  const outcome = await runAgentStep(ctx, state, { role: "tester", prompt });
  const guarded = await revertViolations(ctx, outcome.state, {
    before,
    target: "tester",
    patterns: [],
    testerPaths: [],
  });
  const changed = await ctx.deps.vcs.changedFiles(before);
  const testerPaths = [...new Set([...state.testerPaths, ...changed])].sort();
  const tracked = { ...guarded, testerPaths };
  if (outcome.kind === "stopped") return tracked;
  await ctx.deps.vcs.commit(
    `chore(conductor): tester iteration ${String(state.iteration)}`,
  );
  return { ...tracked, step: "checks" };
};

export const checksStep: StepHandler = async (ctx, state) => {
  const checkResults: CheckResult[] = [];
  for (const check of ctx.config.checks) {
    checkResults.push(await ctx.deps.checks.run(check));
  }
  return { ...state, checkResults, step: "review" };
};
