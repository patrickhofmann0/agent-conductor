import { z } from "zod";

import type {
  Comment,
  Review,
  ReviewState,
} from "../../core/ports/forge.types.js";

/** Associations with (at least) write access to the repository. */
const APPROVERS: ReadonlySet<string> = new Set([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
]);

const userSchema = z.object({ login: z.string() }).nullable();

export const issueSchema = z.object({
  title: z.string(),
  body: z.string().nullable(),
  html_url: z.string(),
});

export const pullRequestListSchema = z.array(
  z.object({
    number: z.int(),
    url: z.string(),
    isDraft: z.boolean(),
    labels: z.array(z.object({ name: z.string() })),
  }),
);

const reviewSchema = z.object({
  user: userSchema,
  state: z.string(),
  body: z.string().nullable(),
  submitted_at: z.string().nullable().optional(),
  author_association: z.string(),
});

const commentSchema = z.object({
  user: userSchema,
  body: z.string().nullable(),
  created_at: z.string(),
  author_association: z.string(),
});

const STATES: Readonly<Record<string, ReviewState>> = {
  APPROVED: "approve",
  CHANGES_REQUESTED: "request_changes",
  COMMENTED: "comment",
};

/** Parses `--jq '.[] | @json'` output: one JSON value per line. */
export function jsonLines(output: string): unknown[] {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): unknown => JSON.parse(line));
}

/** Submitted reviews; pending and dismissed reviews are left out. */
export function toReviews(output: string): Review[] {
  return jsonLines(output).flatMap((value) => {
    const review = reviewSchema.parse(value);
    const state = STATES[review.state];
    if (state === undefined || review.submitted_at == null) return [];
    return [
      {
        author: review.user?.login ?? "ghost",
        authorCanApprove: APPROVERS.has(review.author_association),
        state,
        body: review.body ?? "",
        submittedAt: Date.parse(review.submitted_at),
      },
    ];
  });
}

export function toComments(output: string): Comment[] {
  return jsonLines(output).map((value) => {
    const comment = commentSchema.parse(value);
    return {
      author: comment.user?.login ?? "ghost",
      authorCanApprove: APPROVERS.has(comment.author_association),
      body: comment.body ?? "",
      createdAt: Date.parse(comment.created_at),
    };
  });
}
