import { describe, expect, it } from "vitest";

import { STEPS, runStateSchema } from "./state.js";

const state = {
  schemaVersion: 1,
  runId: "20261106-ab12",
  status: "running",
  step: "po",
  iteration: 0,
  humanIterations: 0,
  route: "both",
  input: {
    kind: "issue",
    title: "CSV export",
    body: "Please add it",
    ref: "o/r#42",
  },
  baseCommit: "abc123",
  branch: "conductor/20261106-ab12-csv-export",
  startedAt: 1_700_000_000_000,
  activeMs: 0,
  costUsd: 0,
  extensions: 0,
  needsHuman: false,
  testerPaths: [],
  findings: [],
  violations: [],
  checkResults: [],
  lastVerdict: null,
  gateFeedback: null,
  outcome: null,
  history: [],
};

describe("runStateSchema", () => {
  it("accepts a fresh run", () => {
    expect(runStateSchema.parse(state)).toEqual(state);
  });

  it("accepts a run with history, verdict and feedback", () => {
    const later = {
      ...state,
      status: "waiting_for_gate",
      step: "planner_gate",
      iteration: 2,
      activeMs: 5_000,
      extensions: 1,
      gateFeedback: "Split into two stories",
      outcome: "Waiting for approval",
      lastVerdict: {
        verdict: "approve",
        route: "both",
        summary: "ok",
        findings: [],
      },
      history: [
        {
          step: "po",
          iteration: 1,
          sessionId: "s1",
          status: "completed",
          costUsd: 0.2,
          durationMs: 1000,
        },
      ],
    };

    expect(runStateSchema.parse(later)).toEqual(later);
  });

  it("defaults humanIterations for states saved before it existed", () => {
    const older: Record<string, unknown> = { ...state };
    delete older["humanIterations"];
    expect(runStateSchema.parse(older).humanIterations).toBe(0);
  });

  it("lists steps in pipeline order", () => {
    expect(STEPS).toEqual([
      "po",
      "po_gate",
      "planner",
      "planner_gate",
      "coder",
      "tester",
      "checks",
      "review",
      "final_gate",
      "finalize",
    ]);
  });

  it.each([
    ["unknown schema version", { ...state, schemaVersion: 2 }],
    ["invalid run id", { ...state, runId: "Run 1" }],
    ["run id with trailing symbol", { ...state, runId: "run-1!" }],
    ["negative iteration", { ...state, iteration: -1 }],
    ["negative active time", { ...state, activeMs: -1 }],
    ["negative extensions", { ...state, extensions: -1 }],
    [
      "negative iteration in history",
      {
        ...state,
        history: [
          {
            step: "po",
            iteration: -1,
            sessionId: "s",
            status: "completed",
            costUsd: 0,
            durationMs: 0,
          },
        ],
      },
    ],
    ["unknown status", { ...state, status: "paused" }],
    ["unknown step", { ...state, step: "deploy" }],
    ["negative cost", { ...state, costUsd: -1 }],
    ["empty feedback", { ...state, gateFeedback: "" }],
    ["missing feedback", { ...state, gateFeedback: undefined }],
    ["unknown key", { ...state, extra: true }],
    [
      "unknown input kind",
      { ...state, input: { kind: "email", title: "x", body: "" } },
    ],
  ])("rejects %s", (_name, input) => {
    expect(runStateSchema.safeParse(input).success).toBe(false);
  });
});
