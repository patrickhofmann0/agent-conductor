import { describe, expect, it } from "vitest";

import {
  coderTask,
  plannerTask,
  productOwnerTask,
  reviewerRetryTask,
  reviewerTask,
  testerTask,
} from "./tasks.js";

import type { CheckResult } from "../schemas/check-result.js";
import type { RunInput } from "../schemas/state.js";
import type { Finding } from "../schemas/verdict.js";

const input: RunInput = {
  kind: "prompt",
  title: "CSV export",
  body: "Export reports as CSV.",
};
const coderFinding: Finding = {
  id: "c1",
  severity: "high",
  target: "coder",
  message: "Escape commas",
  source: "reviewer",
};
const testerFinding: Finding = {
  ...coderFinding,
  id: "t1",
  target: "tester",
  message: "Test quotes",
};
const failedCheck: CheckResult = {
  name: "test",
  required: true,
  passed: false,
  exitCode: 1,
  timedOut: false,
  durationMs: 5,
  output: "1 failed",
};

describe("productOwnerTask", () => {
  it("contains the request", () => {
    expect(productOwnerTask(input)).toBe(
      "## Request\n\n# CSV export\n\nExport reports as CSV.",
    );
  });

  it("names the issue reference", () => {
    expect(
      productOwnerTask({ ...input, kind: "issue", ref: "o/r#7" }),
    ).toContain("Source: o/r#7");
  });

  it("includes previous requirements and feedback on revision", () => {
    const task = productOwnerTask(input, {
      previous: "Old reqs",
      feedback: "Add Excel",
    });

    expect(task).toContain("## Previous requirements\n\nOld reqs");
    expect(task).toContain(
      "## Human feedback\n\nAdd Excel\n\nRevise the requirements",
    );
  });

  it.each([
    { previous: null, feedback: "Add Excel" },
    { feedback: "Add Excel" },
  ])("handles a revision without previous artifact (%j)", (context) => {
    const task = productOwnerTask(input, context);

    expect(task).not.toContain("Previous requirements");
    expect(task).toContain("Add Excel");
  });

  it("ignores a previous artifact without feedback", () => {
    expect(productOwnerTask(input, { previous: "Old" })).not.toContain("Old");
  });
});

describe("plannerTask", () => {
  it("contains request and requirements", () => {
    const task = plannerTask({ input, requirements: "R1" });

    expect(task).toContain("## Request");
    expect(task).toContain("## Requirements\n\nR1");
    expect(task).not.toContain("Human feedback");
  });

  it("includes the previous plan and feedback on revision", () => {
    const task = plannerTask({
      input,
      requirements: "R1",
      previous: "P0",
      feedback: "Smaller steps",
    });

    expect(task).toContain("## Previous plan\n\nP0");
    expect(task).toContain("Revise the plan");
  });
});

describe("coderTask and testerTask", () => {
  const base = {
    requirements: "R",
    plan: "P",
    findings: [coderFinding, testerFinding],
    checkResults: [failedCheck],
  };

  it("contain only requirements and plan in the first iteration", () => {
    expect(coderTask({ ...base, iteration: 1 })).toBe(
      "## Requirements\n\nR\n\n## Plan\n\nP",
    );
    expect(testerTask({ ...base, iteration: 1 })).toBe(
      "## Requirements\n\nR\n\n## Plan\n\nP",
    );
  });

  it("give the coder only coder findings and the previous check results", () => {
    const task = coderTask({ ...base, iteration: 2 });

    expect(task).toContain("## Review findings for you (iteration 2)");
    expect(task).toContain("Escape commas");
    expect(task).not.toContain("Test quotes");
    expect(task).toContain(
      "## Check results of the previous iteration\n\n- test (required): FAILED",
    );
  });

  it("give the tester only tester findings", () => {
    const task = testerTask({ ...base, iteration: 3 });

    expect(task).toContain("Test quotes");
    expect(task).not.toContain("Escape commas");
  });
});

describe("reviewerTask", () => {
  it("contains requirements, plan, diff, checks and violations", () => {
    const task = reviewerTask({
      requirements: "R",
      plan: "P",
      iteration: 2,
      diff: "+a",
      checkResults: [failedCheck],
      violations: [{ ...coderFinding, id: "guardrail", source: "framework" }],
    });

    expect(
      task.startsWith(
        "## Requirements\n\nR\n\n## Plan\n\nP\n\n## Changes so far",
      ),
    ).toBe(true);
    expect(task).toContain(
      "## Changes so far (iteration 2)\n\n```diff\n+a\n```",
    );
    expect(task).toContain("## Check results\n\n- test (required): FAILED");
    expect(task).toContain(
      "## Guardrail violations detected by the framework\n\n- [high] guardrail",
    );
  });

  it("adds human feedback only when there is some", () => {
    const input = {
      requirements: "R",
      plan: "P",
      iteration: 2,
      diff: "+a",
      checkResults: [failedCheck],
      violations: [],
    };
    const human = {
      ...coderFinding,
      id: "human-feedback-2",
      source: "human" as const,
    };

    expect(reviewerTask({ ...input, humanFeedback: [] })).not.toContain(
      "Feedback from a human",
    );
    expect(reviewerTask({ ...input, humanFeedback: [human] })).toContain(
      "## Feedback from a human (verify it was addressed)\n\n- [high] human-feedback-2",
    );
  });

  it("tells the reviewer to judge by reading when no checks are configured", () => {
    const task = reviewerTask({
      requirements: "R",
      plan: "P",
      iteration: 1,
      diff: "+a",
      checkResults: [],
      violations: [],
    });

    expect(task).toContain(
      "## Check results\n\nNo automated checks are configured for this repository, and you cannot run commands. Judge the changes by reading the code and the tests. Do not withhold approval only because the tests were not executed;",
    );
  });
});

describe("reviewerRetryTask", () => {
  it("names the error and repeats the expected format", () => {
    const task = reviewerRetryTask("Unexpected token");

    expect(task).toContain("Unexpected token");
    expect(task).toContain("```json");
  });
});
