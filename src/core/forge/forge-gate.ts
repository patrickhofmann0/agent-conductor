import { evaluateGateFeedback } from "./gate-feedback.js";

import type { Forge } from "../ports/forge.types.js";
import type { GateHandler } from "../ports/gate-handler.types.js";

export interface ForgeGateOptions {
  readonly forge: Forge;
  readonly approvedLabel: string;
}

/**
 * Gates on the run's pull request (CI, or locally with `--gates github`):
 * without a decision the run pauses, `resume` reads reviews and labels.
 */
export function createForgeGateHandler(options: ForgeGateOptions): GateHandler {
  const { forge, approvedLabel } = options;
  return {
    request: async (request) => {
      const pr = await forge.findPullRequest(request.branch);
      if (pr === null) {
        throw new Error(`No open pull request for ${request.branch}.`);
      }
      const decision = evaluateGateFeedback({
        reviews: await forge.listReviews(pr, request.since),
        comments: await forge.listComments(pr, request.since),
        labels: pr.labels,
        approvedLabel,
      });
      if (pr.labels.includes(approvedLabel)) {
        await forge.removeLabels(pr, [approvedLabel]);
      }
      return decision;
    },
    // Nobody can answer in CI; hand the result to a human as a draft.
    resolveLimit: () => Promise.resolve({ kind: "draft_pr" }),
  };
}
