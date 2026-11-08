import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  newState,
  RUN_ID,
} from "../../../../test/fakes/test-engine.js";

import { renderGateBody } from "../pr-body.js";

import {
  finalGateStep,
  plannerGateStep,
  productOwnerGateStep,
} from "./gates.js";

async function engineWithDocuments() {
  const engine = createTestEngine();
  await engine.store.writeArtifact(RUN_ID, "requirements.md", "REQ");
  await engine.store.writeArtifact(RUN_ID, "plan.md", "PLAN");
  return engine;
}

describe("productOwnerGateStep", () => {
  it("publishes the requirements and asks for approval", async () => {
    const engine = await engineWithDocuments();

    await productOwnerGateStep(engine.ctx, newState({ step: "po_gate" }));

    expect(engine.publisher.published).toEqual([
      {
        runId: RUN_ID,
        stage: "gate",
        title: "Add CSV export",
        body: renderGateBody("requirements.md", "REQ"),
      },
    ]);
    expect(engine.gates.requests).toEqual([
      {
        runId: RUN_ID,
        gate: "po",
        artifactName: "requirements.md",
        artifact: "REQ",
      },
    ]);
  });

  it("continues with the planner on approval", async () => {
    const engine = await engineWithDocuments();

    const state = await productOwnerGateStep(
      engine.ctx,
      newState({ step: "po_gate", outcome: "Waiting" }),
    );

    expect(state).toEqual(newState({ step: "planner" }));
  });

  it("repeats the product owner with feedback", async () => {
    const engine = await engineWithDocuments();
    engine.gates.decide("po", { kind: "revise", feedback: "Add Excel" });

    const state = await productOwnerGateStep(
      engine.ctx,
      newState({ step: "po_gate" }),
    );

    expect(state).toEqual(newState({ step: "po", gateFeedback: "Add Excel" }));
  });

  it("aborts with the human's reason", async () => {
    const engine = await engineWithDocuments();
    engine.gates.decide("po", { kind: "abort", reason: "Not needed" });

    const state = await productOwnerGateStep(
      engine.ctx,
      newState({ step: "po_gate" }),
    );

    expect(state).toEqual(
      newState({ step: "po_gate", status: "aborted", outcome: "Not needed" }),
    );
  });

  it("pauses while the decision is pending", async () => {
    const engine = await engineWithDocuments();
    engine.gates.decide("po", { kind: "pending" });

    const state = await productOwnerGateStep(
      engine.ctx,
      newState({ step: "po_gate" }),
    );

    expect(state).toEqual(
      newState({
        step: "po_gate",
        status: "waiting_for_gate",
        outcome: "Waiting for a human to approve requirements.md.",
      }),
    );
  });
});

describe("plannerGateStep", () => {
  it("asks for approval of the plan", async () => {
    const engine = await engineWithDocuments();

    await plannerGateStep(engine.ctx, newState({ step: "planner_gate" }));

    expect(engine.gates.requests[0]).toMatchObject({
      gate: "planner",
      artifactName: "plan.md",
      artifact: "PLAN",
    });
  });

  it("enters the review loop on approval", async () => {
    const engine = await engineWithDocuments();

    const state = await plannerGateStep(
      engine.ctx,
      newState({ step: "planner_gate" }),
    );

    expect(state).toMatchObject({ step: "coder", iteration: 1, route: "both" });
  });

  it("repeats the planner with feedback", async () => {
    const engine = await engineWithDocuments();
    engine.gates.decide("planner", {
      kind: "revise",
      feedback: "Smaller steps",
    });

    const state = await plannerGateStep(
      engine.ctx,
      newState({ step: "planner_gate" }),
    );

    expect(state).toMatchObject({
      step: "planner",
      gateFeedback: "Smaller steps",
    });
  });
});

describe("finalGateStep", () => {
  const approved = {
    step: "final_gate" as const,
    iteration: 2,
    lastVerdict: {
      verdict: "approve" as const,
      route: "both" as const,
      summary: "All criteria met.",
      findings: [],
    },
    checkResults: [
      {
        name: "test",
        required: true,
        passed: true,
        exitCode: 0,
        timedOut: false,
        durationMs: 10,
        output: "ok",
      },
    ],
  };

  it("shows the review summary, checks and changed files", async () => {
    const engine = createTestEngine({ gates: { final: true } });
    engine.vcs.change("src/export.ts", "test/export.test.ts");

    await finalGateStep(engine.ctx, newState(approved));

    expect(engine.gates.requests).toEqual([
      {
        runId: RUN_ID,
        gate: "final",
        artifactName: "summary.md",
        artifact: [
          "# Result",
          "## Review (iteration 2)",
          "All criteria met.",
          "## Checks",
          "- test (required): passed",
          "## Changed files",
          "- src/export.ts\n- test/export.test.ts",
        ].join("\n\n"),
      },
    ]);
    expect(engine.publisher.published[0]?.stage).toBe("gate");
  });

  it("covers a run without review or changes", async () => {
    const engine = createTestEngine({ gates: { final: true } });

    await finalGateStep(engine.ctx, newState({ step: "final_gate" }));

    const artifact = engine.gates.requests[0]?.artifact ?? "";
    expect(artifact).toContain("No review yet.");
    expect(artifact).toContain("## Changed files\n\nNone.");
  });

  it("finalizes on approval", async () => {
    const engine = createTestEngine({ gates: { final: true } });

    const state = await finalGateStep(engine.ctx, newState(approved));

    expect(state.step).toBe("finalize");
    expect(state.status).toBe("running");
  });

  it("starts a human iteration with the feedback for the coder", async () => {
    const engine = createTestEngine({ gates: { final: true } });
    engine.gates.decide("final", { kind: "revise", feedback: "Add a header" });

    const state = await finalGateStep(engine.ctx, newState(approved));

    expect(state).toMatchObject({
      step: "coder",
      iteration: 3,
      humanIterations: 1,
      route: "both",
      findings: [
        {
          id: "human-feedback-3",
          severity: "high",
          target: "coder",
          message: "Add a header",
          source: "human",
        },
      ],
    });
  });

  it("aborts on request", async () => {
    const engine = createTestEngine({ gates: { final: true } });
    engine.gates.decide("final", { kind: "abort", reason: "Wrong approach" });

    const state = await finalGateStep(engine.ctx, newState(approved));

    expect(state).toMatchObject({
      status: "aborted",
      outcome: "Wrong approach",
    });
  });
});
