import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  newState,
  RUN_ID,
} from "../../../../test/fakes/test-engine.js";

import { renderGateBody } from "../pr-body.js";

import { plannerGateStep, productOwnerGateStep } from "./gates.js";

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
