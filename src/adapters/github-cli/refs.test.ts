import { describe, expect, it } from "vitest";

import {
  formatIssueRef,
  parseIssueRef,
  pullRequestNumber,
  repoPath,
} from "./refs.js";

describe("parseIssueRef", () => {
  it("accepts full and short references", () => {
    expect(parseIssueRef("octo/app#42")).toEqual({
      repo: "octo/app",
      number: 42,
    });
    expect(parseIssueRef(" #7 ")).toEqual({ repo: null, number: 7 });
    expect(parseIssueRef("7")).toEqual({ repo: null, number: 7 });
  });

  it("rejects anything else", () => {
    expect(() => parseIssueRef("octo/app")).toThrow(
      'Invalid issue reference "octo/app"; use owner/repo#42 or #42.',
    );
  });
});

describe("formatIssueRef and repoPath", () => {
  it("formats with and without repository", () => {
    expect(formatIssueRef({ repo: "o/r", number: 1 })).toBe("o/r#1");
    expect(formatIssueRef({ repo: null, number: 1 })).toBe("#1");
    expect(repoPath({ repo: "o/r", number: 1 })).toBe("repos/o/r");
    expect(repoPath({ repo: null, number: 1 })).toBe("repos/{owner}/{repo}");
  });
});

describe("pullRequestNumber", () => {
  it("reads the number from the URL", () => {
    expect(pullRequestNumber("https://github.com/o/r/pull/12\n")).toBe(12);
  });

  it("rejects unexpected output", () => {
    expect(() => pullRequestNumber("oops")).toThrow(
      "Unexpected output from gh pr create: oops",
    );
  });
});
