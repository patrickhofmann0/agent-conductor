import { reviseRun } from "../../core/pipeline/engine.js";
import { withEngine, type OpenAgents } from "../engine-setup.js";
import { UsageError } from "../errors.js";
import { openGithub, type OpenForge } from "../forge-setup.js";

import { checkPublishingFlags, openPublishing } from "./publishing.js";

import { DIRTY_TREE, finish, loadReportedConfig } from "./run.js";

import type { Command } from "../cli.types.js";

/**
 * `conductor revise [--no-pr] <run-id> "<feedback>"`: reopens a finished run on
 * its branch, lets coder and tester address the feedback and finishes again.
 */
export function createReviseCommand(
  openAgents: OpenAgents,
  openForge: OpenForge = openGithub,
): Command {
  return async (input) => {
    const { args, io } = input;
    const [runId, ...words] = args;
    const feedback = words.join(" ").trim();
    if (runId === undefined || feedback === "") {
      throw new UsageError("revise needs a run ID and feedback.");
    }
    checkPublishingFlags(input);
    const config = await loadReportedConfig(io);
    const publishing = await openPublishing(input, openForge);
    const setup = { io, config, openAgents, ...publishing };
    return withEngine(setup, async (ctx, vcs) => {
      const { branch } = await ctx.deps.store.loadState(runId);
      if ((await vcs.currentBranch()) !== branch) {
        throw new Error(
          `Run ${runId} works on ${branch}; switch to it first: git switch ${branch}`,
        );
      }
      if (!(await vcs.isClean())) throw new Error(DIRTY_TREE);
      return finish(io, await reviseRun(ctx, runId, feedback), publishing);
    });
  };
}
