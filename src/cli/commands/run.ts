import { randomBytes } from "node:crypto";

import { resumeRun, startRun } from "../../core/pipeline/engine.js";
import { formatRunId } from "../../core/pipeline/naming.js";
import { loadConfig, NO_CHECKS_WARNING } from "../config-file.js";
import { withEngine, type OpenAgents } from "../engine-setup.js";
import { UsageError } from "../errors.js";

import type { Command, CliIo } from "../cli.types.js";
import type { RunInput, RunState } from "../../core/schemas/state.js";

const MAX_TITLE_LENGTH = 72;
export const DIRTY_TREE =
  "The working tree has uncommitted changes; commit or stash them first.";
export const NO_PR_REQUIRED =
  "Pull requests are not supported yet (phase 3 of the plan); pass --no-pr to work on a local branch only.";

function runSuffix(): string {
  return randomBytes(4).readUInt32BE().toString(36).padStart(4, "0").slice(-6);
}

export function promptInput(text: string): RunInput {
  const firstLine = text.trim().split("\n")[0]?.trim() ?? "";
  const title =
    firstLine.length > MAX_TITLE_LENGTH
      ? `${firstLine.slice(0, MAX_TITLE_LENGTH - 1)}…`
      : firstLine;
  return { kind: "prompt", title, body: text.trim() };
}

/** Prints the result; failed and aborted runs exit with 1. */
export function finish(io: CliIo, state: RunState): number {
  io.stdout(`${state.runId} ${state.status} ${state.branch}\n`);
  if (state.status === "waiting_for_gate") {
    io.stderr(`Continue with: conductor resume --no-pr ${state.runId}\n`);
  }
  return state.status === "failed" || state.status === "aborted" ? 1 : 0;
}

const NO_CHECKS_BANNER = `
!!! No checks are configured in conductor.yaml.
!!! Nothing will run your tests: the reviewer can only read the code.
!!! Add your test command under "checks" so conductor can verify the result.

`;

export async function loadReportedConfig(
  io: CliIo,
): Promise<Awaited<ReturnType<typeof loadConfig>>["config"]> {
  const loaded = await loadConfig(io.cwd);
  for (const warning of loaded.warnings) {
    io.stderr(
      warning === NO_CHECKS_WARNING
        ? NO_CHECKS_BANNER
        : `warning: ${warning}\n`,
    );
  }
  return loaded.config;
}

/** `conductor run --no-pr "<task>"`: starts a new run on a fresh branch. */
export function createRunCommand(openAgents: OpenAgents): Command {
  return async ({ args, noPr, io }) => {
    const text = args.join(" ");
    if (text.trim() === "")
      throw new UsageError("run needs a task description.");
    if (!noPr) throw new UsageError(NO_PR_REQUIRED);
    const config = await loadReportedConfig(io);
    return withEngine({ io, config, openAgents }, async (ctx, vcs) => {
      if (!(await vcs.isClean())) throw new Error(DIRTY_TREE);
      const runId = formatRunId(Date.now(), runSuffix());
      io.stderr(`Starting run ${runId}\n`);
      return finish(
        io,
        await startRun(ctx, { runId, input: promptInput(text) }),
      );
    });
  };
}

/** `conductor resume --no-pr <run-id>`: continues a paused or interrupted run. */
export function createResumeCommand(openAgents: OpenAgents): Command {
  return async ({ args, noPr, io }) => {
    const [runId, ...rest] = args;
    if (runId === undefined || rest.length > 0) {
      throw new UsageError("resume needs exactly one run ID.");
    }
    if (!noPr) throw new UsageError(NO_PR_REQUIRED);
    const config = await loadReportedConfig(io);
    return withEngine({ io, config, openAgents }, async (ctx) =>
      finish(io, await resumeRun(ctx, runId)),
    );
  };
}
