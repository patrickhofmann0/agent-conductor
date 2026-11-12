type PublishStage = "gate" | "final" | "needs_human";

export interface PublishRequest {
  readonly runId: string;
  readonly stage: PublishStage;
  readonly title: string;
  readonly body: string;
  readonly branch: string;
  /** The issue the run implements, closed by the final pull request. */
  readonly issueRef: string | null;
}

/**
 * Makes the run visible to humans: pushes the branch and creates or updates the
 * pull request. A no-op when running locally without a pull request.
 */
export interface Publisher {
  publish(request: PublishRequest): Promise<void>;
}
