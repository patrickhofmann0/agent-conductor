import { runAgentStep } from "../agent-step.js";

import type { EngineContext, StepHandler } from "../engine.types.js";
import type { RevisionContext } from "../../prompts/tasks.js";
import type { Config } from "../../schemas/config.js";
import type { RunState } from "../../schemas/state.js";

export interface DocumentStepSpec {
  readonly role: "po" | "planner";
  /** Artifact the agent's answer is stored in. */
  readonly artifact: string;
  readonly task: (
    ctx: EngineContext,
    state: RunState,
    revision: RevisionContext,
  ) => Promise<string>;
  readonly next: (config: Config, state: RunState) => RunState;
}

async function revisionContext(
  ctx: EngineContext,
  state: RunState,
  artifact: string,
): Promise<RevisionContext> {
  if (state.gateFeedback === null) return {};
  const previous = await ctx.deps.store.readArtifact(state.runId, artifact);
  return { feedback: state.gateFeedback, previous };
}

/**
 * A step in which a read-only agent writes a document (requirements, plan).
 * Human feedback from a gate is passed in and consumed.
 */
export function createDocumentStep(spec: DocumentStepSpec): StepHandler {
  return async (ctx, state) => {
    const revision = await revisionContext(ctx, state, spec.artifact);
    const prompt = await spec.task(ctx, state, revision);
    const outcome = await runAgentStep(ctx, state, { role: spec.role, prompt });
    if (outcome.kind === "stopped") return outcome.state;
    await ctx.deps.store.writeArtifact(
      state.runId,
      spec.artifact,
      outcome.output,
    );
    await ctx.deps.vcs.commit(
      `chore(conductor): ${spec.role} wrote ${spec.artifact}`,
    );
    return spec.next(ctx.config, { ...outcome.state, gateFeedback: null });
  };
}
