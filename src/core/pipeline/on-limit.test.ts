import { describe, expect, it } from "vitest";

import { createTestEngine, newState } from "../../../test/fakes/test-engine.js";

import { handleLimit } from "./on-limit.js";

const breach = { kind: "cost" as const, detail: "Cost limit reached." };

describe("handleLimit", () => {
  it("reports the limit", async () => {
    const engine = createTestEngine();

    await handleLimit(engine.ctx, { state: newState(), breach });

    expect(engine.reporter.events).toEqual([
      { type: "limit_reached", ...breach },
    ]);
  });

  it("finishes as a draft for a human by default", async () => {
    const engine = createTestEngine();

    const state = await handleLimit(engine.ctx, {
      state: newState({ step: "coder" }),
      breach,
    });

    expect(state).toEqual(
      newState({
        step: "finalize",
        needsHuman: true,
        outcome: "Cost limit reached.",
      }),
    );
    expect(engine.gates.limitRequests).toEqual([]);
  });

  it("fails the run when configured", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });

    const state = await handleLimit(engine.ctx, {
      state: newState({ step: "coder" }),
      breach,
    });

    expect(state).toEqual(
      newState({
        step: "coder",
        status: "failed",
        outcome: "Cost limit reached.",
      }),
    );
  });

  describe("when configured to ask", () => {
    it("passes the breach to the human", async () => {
      const engine = createTestEngine({ loop: { onLimit: "ask" } });

      await handleLimit(engine.ctx, { state: newState(), breach });

      expect(engine.gates.limitRequests).toEqual([
        { runId: newState().runId, ...breach },
      ]);
    });

    it("grants another budget and continues with the given state", async () => {
      const engine = createTestEngine({ loop: { onLimit: "ask" } });
      engine.gates.decideLimit({ kind: "continue" });
      const continueWith = newState({ step: "tester", extensions: 1 });

      const state = await handleLimit(engine.ctx, {
        state: newState(),
        breach,
        continueWith,
      });

      expect(state).toEqual(newState({ step: "tester", extensions: 2 }));
    });

    it("continues with the current state by default", async () => {
      const engine = createTestEngine({ loop: { onLimit: "ask" } });
      engine.gates.decideLimit({ kind: "continue" });

      const state = await handleLimit(engine.ctx, {
        state: newState({ step: "review" }),
        breach,
      });

      expect(state).toEqual(newState({ step: "review", extensions: 1 }));
    });

    it("can finish as a draft", async () => {
      const engine = createTestEngine({ loop: { onLimit: "ask" } });
      engine.gates.decideLimit({ kind: "draft_pr" });

      const state = await handleLimit(engine.ctx, {
        state: newState(),
        breach,
      });

      expect(state).toMatchObject({
        step: "finalize",
        needsHuman: true,
        status: "running",
      });
    });

    it("can abort with the human's reason", async () => {
      const engine = createTestEngine({ loop: { onLimit: "ask" } });
      engine.gates.decideLimit({ kind: "abort", reason: "Too expensive" });

      const state = await handleLimit(engine.ctx, {
        state: newState(),
        breach,
      });

      expect(state).toMatchObject({
        status: "aborted",
        outcome: "Too expensive",
      });
    });
  });
});
