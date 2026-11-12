import { describe, expect, it } from "vitest";

import { evaluateGateFeedback } from "./gate-feedback.js";

import type { Comment, Review } from "../ports/forge.types.js";

const LABEL = "conductor:approved";

function review(overrides: Partial<Review>): Review {
  return {
    author: "alice",
    authorCanApprove: true,
    state: "comment",
    body: "",
    submittedAt: 10,
    ...overrides,
  };
}

function comment(overrides: Partial<Comment>): Comment {
  return {
    author: "alice",
    authorCanApprove: true,
    body: "note",
    createdAt: 10,
    ...overrides,
  };
}

function evaluate(
  reviews: Review[],
  comments: Comment[] = [],
  labels: string[] = [],
): ReturnType<typeof evaluateGateFeedback> {
  return evaluateGateFeedback({
    reviews,
    comments,
    labels,
    approvedLabel: LABEL,
  });
}

describe("evaluateGateFeedback", () => {
  it("is pending without decisive feedback", () => {
    expect(evaluate([])).toEqual({ kind: "pending" });
    expect(evaluate([review({ state: "comment" })], [comment({})])).toEqual({
      kind: "pending",
    });
  });

  it("approves with the approval label", () => {
    expect(
      evaluate([review({ state: "request_changes" })], [], [LABEL]),
    ).toEqual({ kind: "approve" });
  });

  it("ignores other labels", () => {
    expect(evaluate([], [], ["bug"])).toEqual({ kind: "pending" });
  });

  it("approves with an approving review", () => {
    expect(evaluate([review({ state: "approve" })])).toEqual({
      kind: "approve",
    });
  });

  it("ignores people who may not approve", () => {
    expect(
      evaluate(
        [review({ state: "approve", authorCanApprove: false })],
        [comment({ authorCanApprove: false })],
      ),
    ).toEqual({ kind: "pending" });
  });

  it("follows the latest decisive review", () => {
    expect(
      evaluate([
        review({ state: "approve", submittedAt: 30 }),
        review({ state: "request_changes", body: "no", submittedAt: 20 }),
      ]),
    ).toEqual({ kind: "approve" });
    expect(
      evaluate([
        review({ state: "approve", submittedAt: 20 }),
        review({ state: "request_changes", body: "no", submittedAt: 30 }),
      ]),
    ).toEqual({ kind: "revise", feedback: "no" });
  });

  it("collects reviews and comments up to the change request in order", () => {
    const decision = evaluate(
      [
        review({
          state: "request_changes",
          body: " Fix it. ",
          submittedAt: 30,
        }),
        review({ state: "comment", body: "Also docs.", submittedAt: 10 }),
        review({ state: "comment", body: "Later.", submittedAt: 40 }),
      ],
      [
        comment({ body: "Rename x.", createdAt: 20 }),
        comment({ body: "Outsider", createdAt: 25, authorCanApprove: false }),
        comment({ body: "  ", createdAt: 26 }),
      ],
    );
    expect(decision).toEqual({
      kind: "revise",
      feedback: "Also docs.\n\nRename x.\n\nFix it.",
    });
  });

  it("explains a change request without text", () => {
    expect(evaluate([review({ state: "request_changes" })])).toEqual({
      kind: "revise",
      feedback: "Changes were requested without a comment.",
    });
  });
});
