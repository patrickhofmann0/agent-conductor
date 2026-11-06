import { describe, expect, it } from "vitest";

import { APPROVE_JSON } from "../../../../test/fakes/fake-agent-runner.js";
import {
  createTestEngine,
  loopState,
} from "../../../../test/fakes/test-engine.js";

import { MAX_REVIEW_ATTEMPTS, obtainVerdict } from "./obtain-verdict.js";

describe("obtainVerdict", () => {
  it("returns the first valid verdict", async () => {
    const engine = createTestEngine();

    const outcome = await obtainVerdict(
      engine.ctx,
      await loopState(engine, { step: "review" }),
      "Review",
    );

    expect(outcome).toMatchObject({
      kind: "verdict",
      verdict: { verdict: "approve" },
    });
    expect(engine.agents.requests).toHaveLength(1);
  });

  it("asks again in the same session with the problem", async () => {
    const engine = createTestEngine();
    engine.agents.script(
      "reviewer",
      { output: "Looks fine to me." },
      { output: APPROVE_JSON },
    );

    const outcome = await obtainVerdict(
      engine.ctx,
      await loopState(engine, { step: "review" }),
      "Review",
    );

    expect(outcome.kind).toBe("verdict");
    expect(engine.agents.requests.map((request) => request.sessionId)).toEqual([
      undefined,
      "session-1",
    ]);
    expect(engine.agents.requests[1]?.prompt).toContain(
      "No JSON object found in the answer.",
    );
    expect(outcome.state.history).toHaveLength(2);
    expect(outcome.state.costUsd).toBeCloseTo(0.2);
  });

  it("hands the phase to the limit handling after the last attempt", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });
    engine.agents.script(
      "reviewer",
      { output: "no" },
      { output: "still no" },
      { output: '{"verdict":"maybe"}' },
    );

    const outcome = await obtainVerdict(
      engine.ctx,
      await loopState(engine, { step: "review" }),
      "Review",
    );

    expect(engine.agents.requests).toHaveLength(MAX_REVIEW_ATTEMPTS);
    expect(outcome.kind).toBe("stopped");
    expect(outcome.state.status).toBe("failed");
    expect(outcome.state.outcome).toContain(
      "no valid verdict after 3 attempts",
    );
    expect(outcome.state.outcome).toContain("does not match the format");
    expect(outcome.state.history).toHaveLength(3);
  });

  it("stops when the reviewer agent fails", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });
    engine.agents.script("reviewer", { status: "timeout" });

    const outcome = await obtainVerdict(
      engine.ctx,
      await loopState(engine, { step: "review" }),
      "Review",
    );

    expect(outcome.kind).toBe("stopped");
    expect(engine.agents.requests).toHaveLength(1);
  });
});
