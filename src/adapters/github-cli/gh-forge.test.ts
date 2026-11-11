import { describe, expect, it } from "vitest";

import { createGhForge } from "./gh-forge.js";

import type { GhCommand } from "./gh.js";
import type { PullRequest } from "../../core/ports/forge.types.js";

interface Call {
  readonly args: readonly string[];
  readonly input?: string;
}

/** Answers `gh` calls from recorded outputs, in order. */
function scriptedGh(...outputs: string[]): {
  gh: (command: GhCommand) => Promise<string>;
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    gh: (command) => {
      calls.push(command);
      return Promise.resolve(outputs.shift() ?? "");
    },
  };
}

const PR: PullRequest = {
  number: 12,
  url: "https://github.com/o/r/pull/12",
  draft: true,
  labels: [],
};

const REPO = "repos/{owner}/{repo}";

describe("createGhForge", () => {
  it("reads an issue from another repository", async () => {
    const { gh, calls } = scriptedGh(
      JSON.stringify({
        title: "CSV export",
        body: null,
        html_url: "https://github.com/o/r/issues/42",
        number: 42,
      }),
    );

    const issue = await createGhForge(gh).getIssue("o/r#42");

    expect(calls).toEqual([{ args: ["api", "repos/o/r/issues/42"] }]);
    expect(issue).toEqual({
      ref: "o/r#42",
      title: "CSV export",
      body: "",
      url: "https://github.com/o/r/issues/42",
    });
  });

  it("finds the open pull request of a branch", async () => {
    const { gh, calls } = scriptedGh(
      JSON.stringify([
        {
          number: 12,
          url: PR.url,
          isDraft: true,
          labels: [{ name: "conductor:approved", color: "0e8a16" }],
        },
      ]),
      "[]",
    );
    const forge = createGhForge(gh);

    expect(await forge.findPullRequest("conductor/x")).toEqual({
      ...PR,
      labels: ["conductor:approved"],
    });
    expect(await forge.findPullRequest("conductor/y")).toBeNull();
    expect(calls[0]?.args).toEqual([
      "pr",
      "list",
      "--head",
      "conductor/x",
      "--state",
      "open",
      "--json",
      "number,url,isDraft,labels",
    ]);
  });

  it("creates draft and ready pull requests with the body on stdin", async () => {
    const { gh, calls } = scriptedGh(`${PR.url}\n`, `${PR.url}\n`);
    const forge = createGhForge(gh);
    const draft = { branch: "b", base: "main", title: "T", body: "B" };

    expect(await forge.createPullRequest({ ...draft, draft: true })).toEqual(
      PR,
    );
    await forge.createPullRequest({ ...draft, draft: false });

    const create = ["pr", "create", "--head", "b", "--base", "main"];
    const content = ["--title", "T", "--body-file", "-"];
    expect(calls).toEqual([
      { args: [...create, ...content, "--draft"], input: "B" },
      { args: [...create, ...content], input: "B" },
    ]);
  });

  it("updates, switches draft state and changes labels", async () => {
    const { gh, calls } = scriptedGh();
    const forge = createGhForge(gh);

    await forge.updatePullRequest(PR, { title: "T", body: "B" });
    await forge.setDraft(PR, false);
    await forge.setDraft(PR, true);
    await forge.addLabels(PR, ["a", "b:c"]);
    await forge.removeLabels(PR, ["b:c"]);

    expect(calls).toEqual([
      {
        args: ["pr", "edit", "12", "--title", "T", "--body-file", "-"],
        input: "B",
      },
      { args: ["pr", "ready", "12"] },
      { args: ["pr", "ready", "12", "--undo"] },
      {
        args: ["api", "--method", "POST", `${REPO}/issues/12/labels`].concat([
          "-f",
          "labels[]=a",
          "-f",
          "labels[]=b:c",
        ]),
      },
      { args: ["api", "--method", "DELETE", `${REPO}/issues/12/labels/b%3Ac`] },
    ]);
  });

  it("lists reviews after a point in time", async () => {
    const review = (state: string, at: string): string =>
      JSON.stringify({
        user: { login: "a" },
        state,
        body: state,
        submitted_at: at,
        author_association: "OWNER",
      });
    const { gh, calls } = scriptedGh(
      `${review("COMMENTED", "2026-11-11T09:00:00Z")}\n${review("APPROVED", "2026-11-11T11:00:00Z")}\n`,
    );

    const reviews = await createGhForge(gh).listReviews(
      PR,
      Date.parse("2026-11-11T10:00:00Z"),
    );

    expect(reviews.map((r) => r.state)).toEqual(["approve"]);
    expect(calls[0]?.args).toEqual([
      "api",
      "--paginate",
      `${REPO}/pulls/12/reviews`,
      "--jq",
      ".[] | @json",
    ]);
  });

  it("lists conversation and inline comments after a point in time", async () => {
    const comment = (body: string, at: string): string =>
      `${JSON.stringify({ user: { login: "a" }, body, created_at: at, author_association: "OWNER" })}\n`;
    const { gh, calls } = scriptedGh(
      comment("old", "2026-11-11T09:00:00Z") +
        comment("conversation", "2026-11-11T11:00:00Z"),
      comment("inline", "2026-11-11T12:00:00Z"),
    );

    const comments = await createGhForge(gh).listComments(
      PR,
      Date.parse("2026-11-11T10:00:00Z"),
    );

    expect(comments.map((c) => c.body)).toEqual(["conversation", "inline"]);
    expect(calls.map((call) => call.args[2])).toEqual([
      `${REPO}/issues/12/comments`,
      `${REPO}/pulls/12/comments`,
    ]);
  });

  it("closes issues with GitHub's keyword", () => {
    const forge = createGhForge(scriptedGh().gh);

    expect(forge.closingReference("o/r#42")).toBe("Closes o/r#42");
    expect(forge.closingReference("42")).toBe("Closes #42");
  });
});
