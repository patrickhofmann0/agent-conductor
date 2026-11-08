import { loadDocuments, reviewArtifact } from "./artifacts.js";
import { obtainVerdict } from "./obtain-verdict.js";
import { reviewerTask } from "../../prompts/tasks.js";
import { enforceRequiredChecks, mergeFindings } from "../../review/enforce.js";
import { iterationBreach } from "../limits.js";
import { handleLimit } from "../on-limit.js";
import { nextIteration } from "../transitions.js";

import type { EngineContext, StepHandler } from "../engine.types.js";
import type { RunState } from "../../schemas/state.js";
import type { Verdict } from "../../schemas/verdict.js";

async function decide(
  ctx: EngineContext,
  state: RunState,
  verdict: Verdict,
): Promise<RunState> {
  if (verdict.verdict === "approve") {
    const step = ctx.config.gates.final ? "final_gate" : "finalize";
    return { ...state, step, findings: [] };
  }
  const findings = mergeFindings(verdict.findings, state.violations);
  const next = nextIteration(state, verdict.route, findings);
  const breach = iterationBreach(ctx.config, state);
  if (breach === null) return next;
  return handleLimit(ctx, {
    state: { ...state, findings },
    breach,
    continueWith: next,
  });
}

export const reviewStep: StepHandler = async (ctx, state) => {
  const prompt = reviewerTask({
    ...(await loadDocuments(ctx, state)),
    iteration: state.iteration,
    diff: await ctx.deps.vcs.diff(state.baseCommit),
    checkResults: state.checkResults,
    violations: state.violations,
    humanFeedback: state.findings.filter((f) => f.source === "human"),
  });
  const outcome = await obtainVerdict(ctx, state, prompt);
  if (outcome.kind === "stopped") return outcome.state;
  const verdict = enforceRequiredChecks(outcome.verdict, state.checkResults);
  await ctx.deps.store.writeArtifact(
    state.runId,
    reviewArtifact(state.iteration),
    `${JSON.stringify(verdict, null, 2)}\n`,
  );
  await ctx.deps.vcs.commit(
    `chore(conductor): review iteration ${String(state.iteration)}`,
  );
  return decide(ctx, { ...outcome.state, lastVerdict: verdict }, verdict);
};
