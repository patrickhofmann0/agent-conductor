import {
  formatIssueRef,
  parseIssueRef,
  pullRequestNumber,
  repoPath,
} from "./refs.js";
import {
  issueSchema,
  pullRequestListSchema,
  toComments,
  toReviews,
} from "./responses.js";

import type { Gh } from "./gh.js";
import type {
  Forge,
  NewPullRequest,
  PullRequest,
} from "../../core/ports/forge.types.js";

const CURRENT_REPO = "repos/{owner}/{repo}";
const EACH_AS_JSON = [".[] | @json"];

async function getIssue(gh: Gh, text: string): ReturnType<Forge["getIssue"]> {
  const ref = parseIssueRef(text);
  const output = await gh({
    args: ["api", `${repoPath(ref)}/issues/${String(ref.number)}`],
  });
  const issue = issueSchema.parse(JSON.parse(output));
  return {
    ref: formatIssueRef(ref),
    title: issue.title,
    body: issue.body ?? "",
    url: issue.html_url,
  };
}

async function findPullRequest(
  gh: Gh,
  branch: string,
): Promise<PullRequest | null> {
  const output = await gh({
    args: [
      "pr",
      "list",
      "--head",
      branch,
      "--state",
      "open",
      "--json",
      "number,url,isDraft,labels",
    ],
  });
  const [pr] = pullRequestListSchema.parse(JSON.parse(output));
  if (pr === undefined) return null;
  return {
    number: pr.number,
    url: pr.url,
    draft: pr.isDraft,
    labels: pr.labels.map((label) => label.name),
  };
}

function list(gh: Gh, path: string): Promise<string> {
  return gh({
    args: [
      "api",
      "--paginate",
      `${CURRENT_REPO}/${path}`,
      "--jq",
      ...EACH_AS_JSON,
    ],
  });
}

async function createPullRequest(
  gh: Gh,
  pr: NewPullRequest,
): Promise<PullRequest> {
  const target = ["--head", pr.branch, "--base", pr.base];
  const content = ["--title", pr.title, "--body-file", "-"];
  const draft = pr.draft ? ["--draft"] : [];
  const output = await gh({
    args: ["pr", "create", ...target, ...content, ...draft],
    input: pr.body,
  });
  const number = pullRequestNumber(output);
  return { number, url: output.trim(), draft: pr.draft, labels: [] };
}

/** The forge port on top of the GitHub CLI (ADR 0013). */
export function createGhForge(gh: Gh): Forge {
  return {
    getIssue: (ref) => getIssue(gh, ref),
    findPullRequest: (branch) => findPullRequest(gh, branch),
    createPullRequest: (pr) => createPullRequest(gh, pr),
    updatePullRequest: async (pr, patch) => {
      const edit = ["pr", "edit", String(pr.number)];
      await gh({
        args: [...edit, "--title", patch.title, "--body-file", "-"],
        input: patch.body,
      });
    },
    setDraft: async (pr, draft) => {
      const undo = draft ? ["--undo"] : [];
      await gh({ args: ["pr", "ready", String(pr.number), ...undo] });
    },
    addLabels: async (pr, labels) => {
      const fields = labels.flatMap((label) => ["-f", `labels[]=${label}`]);
      await gh({
        args: ["api", "--method", "POST"].concat([
          `${CURRENT_REPO}/issues/${String(pr.number)}/labels`,
          ...fields,
        ]),
      });
    },
    removeLabels: async (pr, labels) => {
      for (const label of labels) {
        const path = `${CURRENT_REPO}/issues/${String(pr.number)}/labels/${encodeURIComponent(label)}`;
        await gh({ args: ["api", "--method", "DELETE", path] });
      }
    },
    listReviews: async (pr, since) => {
      const output = await list(gh, `pulls/${String(pr.number)}/reviews`);
      return toReviews(output).filter((review) => review.submittedAt > since);
    },
    listComments: async (pr, since) => {
      const number = String(pr.number);
      const comments = [
        ...toComments(await list(gh, `issues/${number}/comments`)),
        ...toComments(await list(gh, `pulls/${number}/comments`)),
      ];
      return comments.filter((comment) => comment.createdAt > since);
    },
    closingReference: (ref) => `Closes ${formatIssueRef(parseIssueRef(ref))}`,
  };
}
