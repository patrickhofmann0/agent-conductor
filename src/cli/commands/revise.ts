import { reviseRun } from "../../core/pipeline/engine.js";
import { withEngine, type OpenAgents } from "../engine-setup.js";
import { UsageError } from "../errors.js";

import {
  DIRTY_TREE,
  finish,
  loadReportedConfig,
  NO_PR_REQUIRED,
} from "./run.js";

import type { Command } from "../cli.types.js";

/**
 * `conductor revise --no-pr <run-id> "<feedback>"`: reopens a finished run on
 * its branch, lets coder and tester address the feedback and finishes again.
 */
export function createReviseCommand(openAgents: OpenAgents): Command {
  return async ({ args, noPr, io }) => {
    const [runId, ...words] = args;
    const feedback = words.join(" ").trim();
    if (runId === undefined || feedback === "") {
      throw new UsageError("revise needs a run ID and feedback.");
    }
    if (!noPr) throw new UsageError(NO_PR_REQUIRED);
    const config = await loadReportedConfig(io);
    return withEngine({ io, config, openAgents }, async (ctx, vcs) => {
      const { branch } = await ctx.deps.store.loadState(runId);
      if ((await vcs.currentBranch()) !== branch) {
        throw new Error(
          `Run ${runId} works on ${branch}; switch to it first: git switch ${branch}`,
        );
      }
      if (!(await vcs.isClean())) throw new Error(DIRTY_TREE);
      return finish(io, await reviseRun(ctx, runId, feedback));
    });
  };
}
