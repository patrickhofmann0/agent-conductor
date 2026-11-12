import type { GateDecision } from "../ports/gate-handler.types.js";
import type { Comment, Review } from "../ports/forge.types.js";

export interface GateFeedback {
  readonly reviews: readonly Review[];
  readonly comments: readonly Comment[];
  readonly labels: readonly string[];
  readonly approvedLabel: string;
}

const NO_FEEDBACK = "Changes were requested without a comment.";

function feedbackText(feedback: GateFeedback, decisive: Review): string {
  const texts = [
    ...feedback.reviews
      .filter((review) => review.authorCanApprove)
      .map((review) => ({ at: review.submittedAt, body: review.body })),
    ...feedback.comments
      .filter((comment) => comment.authorCanApprove)
      .map((comment) => ({ at: comment.createdAt, body: comment.body })),
  ]
    .filter((entry) => entry.at <= decisive.submittedAt)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.body.trim())
    .filter((body) => body !== "");
  return texts.length === 0 ? NO_FEEDBACK : texts.join("\n\n");
}

/**
 * Turns pull request activity since a gate opened into a decision (ADR 0005):
 * the approval label or the latest approving review continues, the latest
 * change request revises with all comments up to it. Only people who may
 * approve count.
 */
export function evaluateGateFeedback(feedback: GateFeedback): GateDecision {
  if (feedback.labels.includes(feedback.approvedLabel)) {
    return { kind: "approve" };
  }
  const decisive = feedback.reviews
    .filter((review) => review.authorCanApprove && review.state !== "comment")
    .reduce<Review | null>(
      (latest, review) =>
        latest === null || review.submittedAt >= latest.submittedAt
          ? review
          : latest,
      null,
    );
  if (decisive === null) return { kind: "pending" };
  if (decisive.state === "approve") return { kind: "approve" };
  return { kind: "revise", feedback: feedbackText(feedback, decisive) };
}
