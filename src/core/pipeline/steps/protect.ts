import {
  guardrailViolations,
  violationFinding,
} from "../../guardrails/violations.js";
import { mergeFindings } from "../../review/enforce.js";

import type { EngineContext } from "../engine.types.js";
import type { RunState } from "../../schemas/state.js";

export interface ProtectRequest {
  /** Commit before the agent started. */
  readonly before: string;
  readonly target: "coder" | "tester";
  readonly patterns: readonly string[];
  readonly testerPaths: readonly string[];
}

/**
 * Reverts changes the agent was not allowed to make and records a finding
 * (ADR 0007). Runs even when the agent failed, so nothing protected is kept.
 */
export async function revertViolations(
  ctx: EngineContext,
  state: RunState,
  request: ProtectRequest,
): Promise<RunState> {
  const changed = await ctx.deps.vcs.changedFiles(request.before);
  const paths = guardrailViolations({
    changed,
    patterns: request.patterns,
    testerPaths: request.testerPaths,
  });
  if (paths.length === 0) return state;
  await ctx.deps.vcs.revertPaths(paths, request.before);
  ctx.deps.reporter.report({ type: "guardrail_reverted", paths });
  const finding = violationFinding({
    paths,
    iteration: state.iteration,
    target: request.target,
  });
  return { ...state, violations: mergeFindings(state.violations, [finding]) };
}
