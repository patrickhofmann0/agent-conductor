const ISSUE_REF = /^(?:([\w.-]+\/[\w.-]+))?#?(\d+)$/;

export interface IssueRef {
  /** "owner/repo", or null for the repository in the working directory. */
  readonly repo: string | null;
  readonly number: number;
}

/** Accepts "owner/repo#42", "#42" and "42". */
export function parseIssueRef(text: string): IssueRef {
  const match = ISSUE_REF.exec(text.trim());
  const number = match?.[2];
  if (match === null || number === undefined) {
    throw new Error(
      `Invalid issue reference "${text}"; use owner/repo#42 or #42.`,
    );
  }
  return { repo: match[1] ?? null, number: Number(number) };
}

export function formatIssueRef(ref: IssueRef): string {
  return `${ref.repo ?? ""}#${String(ref.number)}`;
}

/** `gh api` path of the repository; `{owner}/{repo}` is filled in by gh. */
export function repoPath(ref: IssueRef): string {
  return `repos/${ref.repo ?? "{owner}/{repo}"}`;
}

const PULL_URL = /\/pull\/(\d+)\s*$/;

/** The pull request number from the URL `gh pr create` prints. */
export function pullRequestNumber(output: string): number {
  const number = PULL_URL.exec(output.trim())?.[1];
  if (number === undefined) {
    throw new Error(`Unexpected output from gh pr create: ${output.trim()}`);
  }
  return Number(number);
}
