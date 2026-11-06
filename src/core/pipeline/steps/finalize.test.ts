import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  loopState,
  newState,
  RUN_ID,
} from "../../../../test/fakes/test-engine.js";

import { finalizeStep } from "./finalize.js";

describe("finalizeStep", () => {
  it("archives, squashes and publishes an approved run", async () => {
    const engine = createTestEngine({
      git: { commitMessage: "feat: {{title}}" },
    });

    const state = await finalizeStep(
      engine.ctx,
      await loopState(engine, { step: "finalize" }),
    );

    expect(engine.store.archived).toEqual(new Set([RUN_ID]));
    expect(engine.vcs.squashes).toEqual([
      { since: "base", message: "feat: Add CSV export" },
    ]);
    expect(engine.publisher.published).toEqual([
      expect.objectContaining({
        runId: RUN_ID,
        stage: "final",
        title: "Add CSV export",
      }),
    ]);
    expect(engine.publisher.published[0]?.body).toContain(
      "<summary>Plan</summary>\n\n# Plan",
    );
    expect(state).toMatchObject({
      status: "done",
      outcome: "Approved by the reviewer.",
    });
  });

  it("publishes a run that needs a human as such", async () => {
    const engine = createTestEngine();

    const state = await finalizeStep(
      engine.ctx,
      await loopState(engine, {
        step: "finalize",
        needsHuman: true,
        outcome: "Cost limit reached.",
      }),
    );

    expect(engine.publisher.published[0]?.stage).toBe("needs_human");
    expect(engine.publisher.published[0]?.body).toContain(
      "Cost limit reached.",
    );
    expect(state).toMatchObject({
      status: "needs_human",
      outcome: "Cost limit reached.",
    });
  });

  it("works before any document was written", async () => {
    const engine = createTestEngine();

    const state = await finalizeStep(
      engine.ctx,
      newState({ step: "finalize", needsHuman: true }),
    );

    expect(engine.publisher.published[0]?.body).toContain("(not created)");
    expect(state.status).toBe("needs_human");
  });
});
