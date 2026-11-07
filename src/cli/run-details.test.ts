import { describe, expect, it } from "vitest";

import { createRunState } from "../core/pipeline/create-state.js";

import { formatRunDetails } from "./run-details.js";

import type { RunState } from "../core/schemas/state.js";

const STATE: RunState = {
  ...createRunState({
    runId: "20261107-a",
    input: { kind: "prompt", title: "Add CSV export", body: "Add CSV export" },
    branch: "conductor/20261107-a-add-csv-export",
    baseCommit: "abc",
    startedAt: Date.UTC(2026, 10, 7, 12),
  }),
  status: "done",
  step: "finalize",
  iteration: 2,
  activeMs: 125_000,
  costUsd: 0.0071,
  outcome: "Approved by the reviewer.",
  history: [
    {
      step: "po",
      iteration: 0,
      sessionId: "s1",
      status: "completed",
      costUsd: 0.0006,
      durationMs: 14_000,
    },
    {
      step: "review",
      iteration: 2,
      sessionId: "s2",
      status: "completed",
      costUsd: 0.02,
      durationMs: 27_400,
    },
  ],
};

const CHANGES = JSON.stringify({
  verdict: "changes_requested",
  route: "tester",
  summary: "Tests are missing.",
  findings: [
    {
      id: "f1",
      severity: "high",
      target: "tester",
      file: "test/a.test.ts",
      line: 3,
      message: "Add a test for empty input.",
    },
    { id: "f2", severity: "low", target: "coder", message: "Rename x." },
  ],
});

const APPROVE = JSON.stringify({
  verdict: "approve",
  route: "both",
  summary: "All good.",
  findings: [],
});

describe("formatRunDetails", () => {
  it("shows summary, history, documents and every review", () => {
    const text = formatRunDetails({
      state: STATE,
      requirements: "# Requirements\n",
      plan: "# Plan\n",
      reviews: [CHANGES, APPROVE],
    });

    expect(text).toBe(
      [
        "Run 20261107-a: done (Approved by the reviewer.)",
        "Task:       Add CSV export",
        "Branch:     conductor/20261107-a-add-csv-export",
        "Started:    2026-11-07T12:00:00.000Z",
        "Step:       finalize, iteration 2",
        "Active:     2m 5s",
        "Cost:       $0.0071",
        "",
        "## History",
        "",
        "- po: completed, 14s, $0.0006",
        "- review (iteration 2): completed, 27s, $0.02",
        "",
        "## Requirements",
        "",
        "# Requirements",
        "",
        "## Plan",
        "",
        "# Plan",
        "",
        "## Review 1",
        "",
        "Verdict: changes_requested, route: tester",
        "",
        "Tests are missing.",
        "",
        "- [high] tester test/a.test.ts:3: Add a test for empty input.",
        "- [low] coder: Rename x.",
        "",
        "## Review 2",
        "",
        "Verdict: approve, route: both",
        "",
        "All good.",
        "",
        "No findings.",
        "",
      ].join("\n"),
    );
  });

  it("covers a run that has only just started", () => {
    const text = formatRunDetails({
      state: { ...STATE, status: "running", outcome: null, history: [] },
      requirements: null,
      plan: "  ",
      reviews: [],
    });

    expect(text).toContain("Run 20261107-a: running\n");
    expect(text).toContain("## History\n\nNo agent has run yet.");
    expect(text).toContain("## Requirements\n\n(not written yet)");
    expect(text).toContain("## Plan\n\n(not written yet)");
    expect(text).toContain("## Reviews\n\nNo review yet.\n");
  });

  it.each([
    ["not JSON", "oops"],
    ["not a verdict", '{"verdict":"maybe"}'],
  ])("shows a review that is %s as it is", (_what, raw) => {
    const text = formatRunDetails({
      state: STATE,
      requirements: null,
      plan: null,
      reviews: [raw],
    });
    expect(text).toContain(`## Review 1\n\n${raw}\n`);
  });

  it("shows a file reference without a line", () => {
    const review = JSON.stringify({
      verdict: "changes_requested",
      summary: "Fix it.",
      findings: [
        {
          id: "f",
          severity: "medium",
          target: "coder",
          file: "src/a.ts",
          message: "Bug.",
        },
      ],
    });
    const text = formatRunDetails({
      state: STATE,
      requirements: null,
      plan: null,
      reviews: [review],
    });
    expect(text).toContain("- [medium] coder src/a.ts: Bug.");
  });
});
