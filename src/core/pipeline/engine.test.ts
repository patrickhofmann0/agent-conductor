import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  newState,
  RUN_ID,
} from "../../../test/fakes/test-engine.js";

import { resumeRun, runPipeline, startRun } from "./engine.js";

const input = {
  kind: "prompt" as const,
  title: "Add CSV export",
  body: "Users need CSV.",
};

describe("startRun", () => {
  it("creates the branch from the base branch and saves the initial state", async () => {
    const engine = createTestEngine({
      gates: { po: false, planner: false },
      git: { baseBranch: "develop" },
    });

    await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(engine.vcs.branches).toEqual([
      { name: `conductor/${RUN_ID}-add-csv-export`, base: "develop" },
    ]);
    expect(engine.store.saved[0]).toMatchObject({
      runId: RUN_ID,
      step: "po",
      status: "running",
      baseCommit: "base",
      startedAt: 1_000_000,
    });
  });

  it("runs the whole pipeline to a published pull request", async () => {
    const engine = createTestEngine();

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state.status).toBe("done");
    expect(engine.agents.requests.map((request) => request.role)).toEqual([
      "po",
      "planner",
      "coder",
      "tester",
      "reviewer",
    ]);
    expect(engine.publisher.published.map((request) => request.stage)).toEqual([
      "gate",
      "gate",
      "final",
    ]);
  });
});

describe("runPipeline", () => {
  it("saves the state after every step", async () => {
    const engine = createTestEngine({ gates: { po: false, planner: false } });

    await runPipeline(engine.ctx, newState());

    expect(engine.store.saved.map((saved) => saved.step)).toEqual([
      "planner",
      "coder",
      "tester",
      "checks",
      "review",
      "finalize",
      "finalize",
    ]);
    expect(engine.store.saved.at(-1)?.status).toBe("done");
  });

  it("reports each step and the end of the run", async () => {
    const engine = createTestEngine({ gates: { po: false, planner: false } });

    await runPipeline(engine.ctx, newState());

    expect(
      engine.reporter.ofType("step_started").map((event) => event.step),
    ).toEqual([
      "po",
      "planner",
      "coder",
      "tester",
      "checks",
      "review",
      "finalize",
    ]);
    expect(engine.reporter.events.at(-1)).toEqual({
      type: "run_finished",
      status: "done",
      reason: "Approved by the reviewer.",
    });
  });

  it("counts active time but not time spent at gates", async () => {
    const engine = createTestEngine();
    engine.gates.request = () => {
      engine.clock.advance(86_400_000);
      return Promise.resolve({ kind: "approve" });
    };

    const state = await runPipeline(engine.ctx, newState());

    expect(state.activeMs).toBe(5_000);
  });

  it("applies the budget before starting a step", async () => {
    const engine = createTestEngine({
      loop: { onLimit: "fail" },
      limits: { maxCostUsd: 1 },
    });

    const state = await runPipeline(engine.ctx, newState({ costUsd: 1 }));

    expect(state).toMatchObject({
      status: "failed",
      step: "po",
      outcome: "Cost limit reached: $1.00 of $1.00.",
    });
    expect(engine.agents.requests).toEqual([]);
  });

  it("finalizes even when the budget is used up", async () => {
    const engine = createTestEngine({ limits: { maxCostUsd: 1 } });

    const state = await runPipeline(
      engine.ctx,
      newState({ step: "finalize", costUsd: 5, needsHuman: true }),
    );

    expect(state.status).toBe("needs_human");
  });

  it("reports a pause when waiting for a gate", async () => {
    const engine = createTestEngine();
    engine.gates.decide("po", { kind: "pending" });

    const state = await runPipeline(engine.ctx, newState());

    expect(state.status).toBe("waiting_for_gate");
    expect(engine.reporter.events.at(-1)).toEqual({
      type: "run_paused",
      reason: "Waiting for a human to approve requirements.md.",
    });
  });

  it("returns a finished state without doing anything", async () => {
    const engine = createTestEngine();

    const state = await runPipeline(engine.ctx, newState({ status: "done" }));

    expect(state.status).toBe("done");
    expect(engine.store.saved).toEqual([]);
    expect(engine.reporter.events).toEqual([
      { type: "run_finished", status: "done", reason: "" },
    ]);
  });
});

describe("resumeRun", () => {
  it("continues a run that waits at a gate", async () => {
    const engine = createTestEngine();
    await engine.store.saveState(
      newState({
        step: "po_gate",
        status: "waiting_for_gate",
        outcome: "Waiting",
      }),
    );
    await engine.store.writeArtifact(RUN_ID, "requirements.md", "REQ");

    const state = await resumeRun(engine.ctx, RUN_ID);

    expect(engine.gates.requests[0]?.gate).toBe("po");
    expect(state.status).toBe("done");
  });

  it("continues an interrupted run at its current step", async () => {
    const engine = createTestEngine({ gates: { planner: false } });
    await engine.store.saveState(newState({ step: "planner" }));
    await engine.store.writeArtifact(RUN_ID, "requirements.md", "REQ");

    const state = await resumeRun(engine.ctx, RUN_ID);

    expect(engine.agents.requests[0]?.role).toBe("planner");
    expect(state.status).toBe("done");
  });

  it.each(["done", "needs_human", "failed", "aborted"] as const)(
    "leaves a %s run alone",
    async (status) => {
      const engine = createTestEngine();
      await engine.store.saveState(newState({ status }));

      const state = await resumeRun(engine.ctx, RUN_ID);

      expect(state.status).toBe(status);
      expect(engine.agents.requests).toEqual([]);
      expect(engine.reporter.events).toEqual([]);
    },
  );

  it("fails for an unknown run", async () => {
    const engine = createTestEngine();

    await expect(resumeRun(engine.ctx, "unknown")).rejects.toThrow(
      "Unknown run unknown",
    );
  });
});
