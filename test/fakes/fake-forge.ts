import type {
  Comment,
  Forge,
  Issue,
  NewPullRequest,
  PullRequest,
  PullRequestPatch,
  Review,
} from "../../src/core/ports/forge.types.js";

interface StoredPullRequest extends PullRequest {
  readonly branch: string;
  readonly base: string;
  readonly title: string;
  readonly body: string;
}

/** An in-memory forge that records every pull request change. */
export class FakeForge implements Forge {
  readonly issues = new Map<string, Issue>();
  readonly pullRequests: StoredPullRequest[] = [];
  readonly reviews: Review[] = [];
  readonly comments: Comment[] = [];
  readonly sinceRequests: number[] = [];

  getIssue(ref: string): Promise<Issue> {
    const issue = this.issues.get(ref);
    if (issue === undefined) return Promise.reject(new Error(`No ${ref}`));
    return Promise.resolve(issue);
  }

  findPullRequest(branch: string): Promise<PullRequest | null> {
    const pr = this.pullRequests.find((p) => p.branch === branch);
    return Promise.resolve(pr ?? null);
  }

  createPullRequest(pr: NewPullRequest): Promise<PullRequest> {
    const number = this.pullRequests.length + 1;
    const created = {
      ...pr,
      number,
      url: `https://forge.test/pr/${String(number)}`,
      labels: [],
    };
    this.pullRequests.push(created);
    return Promise.resolve(created);
  }

  updatePullRequest(pr: PullRequest, patch: PullRequestPatch): Promise<void> {
    this.change(pr, (stored) => ({ ...stored, ...patch }));
    return Promise.resolve();
  }

  setDraft(pr: PullRequest, draft: boolean): Promise<void> {
    this.change(pr, (stored) => ({ ...stored, draft }));
    return Promise.resolve();
  }

  addLabels(pr: PullRequest, labels: readonly string[]): Promise<void> {
    this.change(pr, (stored) => ({
      ...stored,
      labels: [...new Set([...stored.labels, ...labels])],
    }));
    return Promise.resolve();
  }

  removeLabels(pr: PullRequest, labels: readonly string[]): Promise<void> {
    this.change(pr, (stored) => ({
      ...stored,
      labels: stored.labels.filter((label) => !labels.includes(label)),
    }));
    return Promise.resolve();
  }

  listReviews(_pr: PullRequest, since: number): Promise<readonly Review[]> {
    this.sinceRequests.push(since);
    return Promise.resolve(this.reviews.filter((r) => r.submittedAt > since));
  }

  listComments(_pr: PullRequest, since: number): Promise<readonly Comment[]> {
    return Promise.resolve(this.comments.filter((c) => c.createdAt > since));
  }

  closingReference(issueRef: string): string {
    return `Closes ${issueRef}`;
  }

  private change(
    pr: PullRequest,
    update: (stored: StoredPullRequest) => StoredPullRequest,
  ): void {
    const index = this.pullRequests.findIndex((p) => p.number === pr.number);
    const stored = this.pullRequests[index];
    if (stored === undefined) throw new Error(`No PR ${String(pr.number)}`);
    this.pullRequests[index] = update(stored);
  }
}
