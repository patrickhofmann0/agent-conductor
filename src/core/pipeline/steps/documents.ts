import { PLAN, REQUIREMENTS, requireArtifact } from "./artifacts.js";
import { createDocumentStep } from "./document-step.js";
import { plannerTask, productOwnerTask } from "../../prompts/tasks.js";
import { afterPlanner, afterProductOwner } from "../transitions.js";

export const productOwnerStep = createDocumentStep({
  role: "po",
  artifact: REQUIREMENTS,
  task: (_ctx, state, revision) =>
    Promise.resolve(productOwnerTask(state.input, revision)),
  next: afterProductOwner,
});

export const plannerStep = createDocumentStep({
  role: "planner",
  artifact: PLAN,
  task: async (ctx, state, revision) =>
    plannerTask({
      input: state.input,
      requirements: await requireArtifact(ctx, state, REQUIREMENTS),
      ...revision,
    }),
  next: afterPlanner,
});
