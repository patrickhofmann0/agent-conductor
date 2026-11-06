import type { EngineContext } from "../engine.types.js";
import type { ImplementationTaskInput } from "../../prompts/tasks.js";
import type { RunState } from "../../schemas/state.js";

export const REQUIREMENTS = "requirements.md";
export const PLAN = "plan.md";

export function reviewArtifact(iteration: number): string {
  return `review-${String(iteration)}.json`;
}

export async function requireArtifact(
  ctx: EngineContext,
  state: RunState,
  name: string,
): Promise<string> {
  const content = await ctx.deps.store.readArtifact(state.runId, name);
  if (content === null)
    throw new Error(`Artifact ${name} of run ${state.runId} is missing.`);
  return content;
}

export interface Documents {
  readonly requirements: string;
  readonly plan: string;
}

export async function loadDocuments(
  ctx: EngineContext,
  state: RunState,
): Promise<Documents> {
  return {
    requirements: await requireArtifact(ctx, state, REQUIREMENTS),
    plan: await requireArtifact(ctx, state, PLAN),
  };
}

export async function loadImplementationInput(
  ctx: EngineContext,
  state: RunState,
): Promise<ImplementationTaskInput> {
  return {
    ...(await loadDocuments(ctx, state)),
    iteration: state.iteration,
    findings: state.findings,
    checkResults: state.checkResults,
  };
}
