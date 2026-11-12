import { PLAN, REQUIREMENTS } from "./artifacts.js";
import { commitMessage, renderPullRequestBody } from "../pr-body.js";

import type { StepHandler } from "../engine.types.js";

/**
 * Removes the run artifacts from the branch, squashes everything into one
 * commit and publishes the result (ADR 0006).
 */
export const finalizeStep: StepHandler = async (ctx, state) => {
  const { deps, config } = ctx;
  const body = renderPullRequestBody({
    state,
    requirements: await deps.store.readArtifact(state.runId, REQUIREMENTS),
    plan: await deps.store.readArtifact(state.runId, PLAN),
  });
  await deps.store.archive(state.runId);
  await deps.vcs.squash({
    since: state.baseCommit,
    message: commitMessage(config.git.commitMessage, state.input.title),
  });
  await deps.publisher.publish({
    runId: state.runId,
    stage: state.needsHuman ? "needs_human" : "final",
    title: state.input.title,
    body,
    branch: state.branch,
    issueRef: state.input.ref ?? null,
  });
  if (state.needsHuman) return { ...state, status: "needs_human" };
  return { ...state, status: "done", outcome: "Approved by the reviewer." };
};
