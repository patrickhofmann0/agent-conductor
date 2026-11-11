import { describe, expect, it } from "vitest";

import { newState } from "../../../test/fakes/test-engine.js";

import {
  commitMessage,
  renderGateBody,
  renderPullRequestBody,
} from "./pr-body.js";

import type { Finding } from "../schemas/verdict.js";

const finding: Finding = {
  id: "f1",
  severity: "high",
  target: "coder",
  message: "Escape commas",
  source: "reviewer",
};
const approved = newState({
  iteration: 2,
  costUsd: 1.234,
  lastVerdict: {
    verdict: "approve",
    route: "both",
    summary: "Exports CSV correctly.",
    findings: [],
  },
});

describe("renderPullRequestBody", () => {
  it("renders summary, checks, run data and documents", () => {
    const body = renderPullRequestBody({
      state: approved,
      requirements: " REQ\n",
      plan: "PLAN",
    });

    expect(body).toBe(
      [
        "## Summary\n\nExports CSV correctly.",
        "## Checks\n\nNo checks are configured.",
        "## Run\n\n| Run ID | Iterations | Cost |\n| --- | --- | --- |\n| `20261106-120000-test` | 2 | $1.23 |",
        "<details>\n<summary>Requirements</summary>\n\nREQ\n\n</details>",
        "<details>\n<summary>Plan</summary>\n\nPLAN\n\n</details>",
        "---\n\n_Created by agent-conductor._",
      ].join("\n\n"),
    );
  });

  it("works without review and documents", () => {
    const body = renderPullRequestBody({
      state: newState({ input: { kind: "prompt", title: "t", body: "" } }),
      requirements: null,
      plan: null,
    });

    expect(body).toContain("No review yet.");
    expect(body).toContain("<summary>Plan</summary>\n\n(not created)");
  });

  it("warns and lists open findings when a human must take over", () => {
    const body = renderPullRequestBody({
      state: {
        ...approved,
        needsHuman: true,
        outcome: "Iteration limit reached.",
        findings: [finding],
      },
      requirements: "REQ",
      plan: "PLAN",
    });

    expect(
      body.startsWith(
        "> [!WARNING]\n> agent-conductor stopped before the reviewer approved: Iteration limit reached.",
      ),
    ).toBe(true);
    expect(body).toContain("## Open findings\n\n- [high] f1: Escape commas");
  });

  it("uses a generic reason and omits empty findings", () => {
    const body = renderPullRequestBody({
      state: { ...approved, needsHuman: true },
      requirements: null,
      plan: null,
    });

    expect(body).toContain("approved: A limit was reached.");
    expect(body).not.toContain("Open findings");
  });

  it("does not list findings of an approved run", () => {
    const body = renderPullRequestBody({
      state: { ...approved, findings: [finding] },
      requirements: null,
      plan: null,
    });

    expect(body).not.toContain("Open findings");
  });
});

describe("renderGateBody", () => {
  it("explains how to continue and shows the artifact", () => {
    expect(renderGateBody("plan.md", "\n# Plan\n")).toBe(
      "> [!NOTE]\n> agent-conductor is waiting for approval of `plan.md`. Approve this pull request to continue, or request changes with your feedback.\n\n# Plan",
    );
  });
});

describe("commitMessage", () => {
  it("replaces every title placeholder", () => {
    expect(commitMessage("feat: {{title}} ({{title}})", "CSV")).toBe(
      "feat: CSV (CSV)",
    );
  });
});
