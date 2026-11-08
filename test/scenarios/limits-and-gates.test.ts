import { describe, expect, it } from "vitest";

import { createTestEngine, RUN_ID } from "../fakes/test-engine.js";
import { resumeRun, startRun } from "../../src/core/pipeline/engine.js";

const input = {
  kind: "prompt" as const,
  title: "Add CSV export",
  body: "Users need CSV.",
};
const noGates = { po: false, planner: false };
const forever =
  '```json\n{"verdict":"changes_requested","route":"coder","summary":"Again","findings":[]}\n```';

describe("scenario: iteration limit", () => {
  it("finishes as a draft for a human by default", async () => {
    const engine = createTestEngine({
      gates: noGates,
      loop: { maxIterations: 2 },
    });
    engine.agents.script("reviewer", { output: forever }, { output: forever });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({ status: "needs_human", iteration: 2 });
    expect(engine.publisher.published.at(-1)?.stage).toBe("needs_human");
    expect(engine.publisher.published.at(-1)?.body).toContain(
      "Iteration limit reached: 2 of 2",
    );
    expect(engine.vcs.squashes).toHaveLength(1);
  });

  it("fails without publishing when configured", async () => {
    const engine = createTestEngine({
      gates: noGates,
      loop: { maxIterations: 1, onLimit: "fail" },
    });
    engine.agents.script("reviewer", { output: forever });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state.status).toBe("failed");
    expect(engine.publisher.published).toEqual([]);
    expect(engine.vcs.squashes).toEqual([]);
  });

  it("asks a human, who grants another round", async () => {
    const engine = createTestEngine({
      gates: noGates,
      loop: { maxIterations: 1, onLimit: "ask" },
    });
    engine.agents.script("reviewer", { output: forever });
    engine.gates.decideLimit({ kind: "continue" });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(engine.gates.limitRequests.map((request) => request.kind)).toEqual([
      "iterations",
    ]);
    expect(state).toMatchObject({
      status: "done",
      iteration: 2,
      extensions: 1,
    });
  });

  it("asks a human, who aborts", async () => {
    const engine = createTestEngine({
      gates: noGates,
      loop: { maxIterations: 1, onLimit: "ask" },
    });
    engine.agents.script("reviewer", { output: forever });
    engine.gates.decideLimit({ kind: "abort", reason: "Wrong approach" });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({
      status: "aborted",
      outcome: "Wrong approach",
    });
  });
});

describe("scenario: budgets", () => {
  it("stops at the cost limit before the next agent runs", async () => {
    const engine = createTestEngine({
      gates: noGates,
      limits: { maxCostUsd: 1 },
    });
    engine.agents
      .script("po", { costUsd: 0.6 })
      .script("planner", { costUsd: 0.6 });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(engine.agents.requests.map((request) => request.role)).toEqual([
      "po",
      "planner",
    ]);
    expect(state).toMatchObject({ status: "needs_human" });
    expect(state.outcome).toBe("Cost limit reached: $1.20 of $1.00.");
  });

  it("stops at the total time limit", async () => {
    const engine = createTestEngine({
      gates: noGates,
      limits: { totalTimeout: "10m" },
      loop: { onLimit: "fail" },
    });
    engine.agents.script("po", { durationMs: 600_000 });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({ status: "failed", step: "planner" });
    expect(state.outcome).toBe("Time limit reached: 10 min of 10 min.");
  });

  it("handles an agent that exceeds the phase timeout", async () => {
    const engine = createTestEngine({
      gates: noGates,
      loop: { onLimit: "ask" },
    });
    engine.agents.script("coder", { status: "timeout" });
    engine.gates.decideLimit({ kind: "continue" });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(engine.agents.requestsFor("coder")).toHaveLength(2);
    expect(state).toMatchObject({ status: "done", extensions: 1 });
  });
});

describe("scenario: gates", () => {
  it("revises the requirements with human feedback", async () => {
    const engine = createTestEngine();
    engine.agents.script("po", { output: "Draft 1" }, { output: "Draft 2" });
    engine.gates.decide("po", {
      kind: "revise",
      feedback: "Also support Excel",
    });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    const second = engine.agents.requestsFor("po")[1]?.prompt ?? "";
    expect(second).toContain("## Previous requirements\n\nDraft 1");
    expect(second).toContain("Also support Excel");
    expect(engine.gates.requests.map((request) => request.artifact)).toEqual([
      "Draft 1",
      "Draft 2",
      "# Plan\n\n1. Add exporter",
    ]);
    expect(state.status).toBe("done");
  });

  it("aborts at the plan gate", async () => {
    const engine = createTestEngine();
    engine.gates.decide("planner", { kind: "abort", reason: "Out of scope" });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({ status: "aborted", outcome: "Out of scope" });
    expect(engine.agents.requestsFor("coder")).toEqual([]);
  });

  it.each(["po", "planner"] as const)(
    "pauses at the %s gate and resumes later",
    async (gate) => {
      const engine = createTestEngine();
      engine.gates.decide(gate, { kind: "pending" }, { kind: "pending" });

      const paused = await startRun(engine.ctx, { runId: RUN_ID, input });
      const stillPaused = await resumeRun(engine.ctx, RUN_ID);
      const finished = await resumeRun(engine.ctx, RUN_ID);

      expect(paused).toMatchObject({
        status: "waiting_for_gate",
        step: `${gate}_gate`,
      });
      expect(stillPaused.status).toBe("waiting_for_gate");
      expect(finished.status).toBe("done");
      expect(engine.agents.requestsFor(gate)).toHaveLength(1);
    },
  );
});

describe("scenario: final gate", () => {
  it("lets a human ask for changes without using up the iteration limit", async () => {
    const engine = createTestEngine({
      gates: { ...noGates, final: true },
      loop: { maxIterations: 1, onLimit: "fail" },
    });
    engine.gates.decide(
      "final",
      { kind: "revise", feedback: "Add a header row" },
      { kind: "approve" },
    );

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({
      status: "done",
      iteration: 2,
      humanIterations: 1,
    });
    expect(engine.gates.requests.map((request) => request.gate)).toEqual([
      "final",
      "final",
    ]);
    expect(engine.agents.requestsFor("coder")[1]?.prompt).toContain(
      "Add a header row",
    );
    expect(engine.agents.requestsFor("reviewer")[1]?.prompt).toContain(
      "## Feedback from a human",
    );
    expect(engine.vcs.squashes).toHaveLength(1);
  });

  it("is skipped unless enabled", async () => {
    const engine = createTestEngine({ gates: noGates });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state.status).toBe("done");
    expect(engine.gates.requests).toEqual([]);
  });
});
