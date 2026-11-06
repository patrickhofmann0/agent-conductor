import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  newState,
  RUN_ID,
} from "../../../../test/fakes/test-engine.js";

import { plannerStep, productOwnerStep } from "./documents.js";

describe("productOwnerStep", () => {
  it("asks the product owner for requirements and stores them", async () => {
    const engine = createTestEngine();
    engine.agents.script("po", { output: "# Reqs" });

    const state = await productOwnerStep(engine.ctx, newState());

    expect(engine.agents.requests[0]?.prompt).toContain(
      "# Add CSV export\n\nUsers need CSV.",
    );
    expect(engine.store.artifact(RUN_ID, "requirements.md")).toBe("# Reqs");
    expect(state.step).toBe("po_gate");
  });

  it("skips the gate when it is disabled", async () => {
    const engine = createTestEngine({ gates: { po: false } });

    expect((await productOwnerStep(engine.ctx, newState())).step).toBe(
      "planner",
    );
  });
});

describe("plannerStep", () => {
  it("gives the planner the requirements and stores the plan", async () => {
    const engine = createTestEngine();
    await engine.store.writeArtifact(RUN_ID, "requirements.md", "REQ-1");
    engine.agents.script("planner", { output: "# Plan" });

    const state = await plannerStep(engine.ctx, newState({ step: "planner" }));

    expect(engine.agents.requests[0]?.role).toBe("planner");
    expect(engine.agents.requests[0]?.prompt).toContain(
      "## Requirements\n\nREQ-1",
    );
    expect(engine.store.artifact(RUN_ID, "plan.md")).toBe("# Plan");
    expect(state.step).toBe("planner_gate");
  });

  it("includes the previous plan when revising", async () => {
    const engine = createTestEngine();
    await engine.store.writeArtifact(RUN_ID, "requirements.md", "REQ-1");
    await engine.store.writeArtifact(RUN_ID, "plan.md", "Old plan");

    await plannerStep(
      engine.ctx,
      newState({ step: "planner", gateFeedback: "Fewer steps" }),
    );

    expect(engine.agents.requests[0]?.prompt).toContain(
      "## Previous plan\n\nOld plan",
    );
    expect(engine.agents.requests[0]?.prompt).toContain("Fewer steps");
  });

  it("enters the review loop when the gate is disabled", async () => {
    const engine = createTestEngine({ gates: { planner: false } });
    await engine.store.writeArtifact(RUN_ID, "requirements.md", "REQ-1");

    const state = await plannerStep(engine.ctx, newState({ step: "planner" }));

    expect(state).toMatchObject({ step: "coder", iteration: 1, route: "both" });
  });
});
