import { describe, expect, it } from "vitest";

import { runStateSchema } from "../schemas/state.js";

import { createRunState } from "./create-state.js";

const run = {
  runId: "20261106-213045-k3x9",
  input: { kind: "prompt" as const, title: "CSV", body: "Export CSV" },
  branch: "conductor/20261106-213045-k3x9-csv",
  baseCommit: "abc",
  startedAt: 42,
};

describe("createRunState", () => {
  it("creates a valid running state at the product owner step", () => {
    const state = createRunState(run);

    expect(runStateSchema.parse(state)).toEqual(state);
    expect(state).toMatchObject({
      status: "running",
      step: "po",
      iteration: 0,
      route: "both",
      activeMs: 0,
      costUsd: 0,
      extensions: 0,
      needsHuman: false,
      gateFeedback: null,
      outcome: null,
    });
  });

  it("keeps the run identity", () => {
    expect(createRunState(run)).toMatchObject(run);
  });
});
