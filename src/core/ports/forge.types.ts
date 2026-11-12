/**
 * Provider-neutral access to the code forge (GitHub today, ADR 0013). Issue
 * references are opaque: only the adapter parses and formats them.
 */
export interface Issue {
  readonly ref: string;
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

export interface PullRequest {
  readonly number: number;
  readonly url: string;
  readonly draft: boolean;
  readonly labels: readonly string[];
}

export interface NewPullRequest {
  readonly branch: string;
  readonly base: string;
  readonly title: string;
  readonly body: string;
  readonly draft: boolean;
}

export interface PullRequestPatch {
  readonly title: string;
  readonly body: string;
}

export type ReviewState = "approve" | "request_changes" | "comment";

export interface Review {
  readonly author: string;
  /** Whether the author may approve, e.g. has write access to the repository. */
  readonly authorCanApprove: boolean;
  readonly state: ReviewState;
  readonly body: string;
  readonly submittedAt: number;
}

export interface Comment {
  readonly author: string;
  readonly authorCanApprove: boolean;
  readonly body: string;
  readonly createdAt: number;
}

export interface Forge {
  getIssue(ref: string): Promise<Issue>;
  /** The open pull request for `branch`, if any. */
  findPullRequest(branch: string): Promise<PullRequest | null>;
  createPullRequest(pr: NewPullRequest): Promise<PullRequest>;
  updatePullRequest(pr: PullRequest, patch: PullRequestPatch): Promise<void>;
  setDraft(pr: PullRequest, draft: boolean): Promise<void>;
  addLabels(pr: PullRequest, labels: readonly string[]): Promise<void>;
  removeLabels(pr: PullRequest, labels: readonly string[]): Promise<void>;
  /** Reviews submitted after `since` (epoch milliseconds). */
  listReviews(pr: PullRequest, since: number): Promise<readonly Review[]>;
  /** Conversation and inline comments created after `since`. */
  listComments(pr: PullRequest, since: number): Promise<readonly Comment[]>;
  /** Text in a pull request body that closes the issue, e.g. "Closes o/r#42". */
  closingReference(issueRef: string): string;
}
