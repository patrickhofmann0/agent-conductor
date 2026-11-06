import { describe, expect, it } from "vitest";

import { createTestEngine, newState } from "../../../test/fakes/test-engine.js";
import { roleSettings } from "../roles/settings.js";

import { runAgentStep } from "./agent-step.js";

describe("runAgentStep", () => {
  it("runs the agent with role settings, prompt and phase timeout", async () => {
    const engine = createTestEngine({
      models: { default: "openai/gpt-5" },
      limits: { phaseTimeout: "5m" },
    });

    await runAgentStep(engine.ctx, newState(), { role: "po", prompt: "Do it" });

    expect(engine.agents.requests).toEqual([
      {
        ...roleSettings(engine.ctx.config, "po"),
        role: "po",
        prompt: "Do it",
        timeoutMs: 300_000,
      },
    ]);
  });

  it("continues an existing session when asked", async () => {
    const engine = createTestEngine();

    await runAgentStep(engine.ctx, newState(), {
      role: "reviewer",
      prompt: "Again",
      sessionId: "s9",
    });

    expect(engine.agents.requests[0]?.sessionId).toBe("s9");
  });

  it("returns the output and records cost and history", async () => {
    const engine = createTestEngine();
    engine.agents.script("po", {
      output: "Reqs",
      costUsd: 0.25,
      durationMs: 2_000,
    });

    const outcome = await runAgentStep(engine.ctx, newState({ costUsd: 1 }), {
      role: "po",
      prompt: "x",
    });

    expect(outcome).toEqual({
      kind: "completed",
      output: "Reqs",
      sessionId: "session-1",
      state: newState({
        costUsd: 1.25,
        history: [
          {
            step: "po",
            iteration: 0,
            sessionId: "session-1",
            status: "completed",
            costUsd: 0.25,
            durationMs: 2_000,
          },
        ],
      }),
    });
    expect(engine.reporter.events).toEqual([
      {
        type: "agent_finished",
        step: "po",
        iteration: 0,
        costUsd: 0.25,
        durationMs: 2_000,
      },
    ]);
  });

  it("stops the run when version control was touched", async () => {
    const engine = createTestEngine();
    engine.agents.script("coder", {
      effect: () => {
        engine.vcs.tamper();
      },
    });

    const outcome = await runAgentStep(
      engine.ctx,
      newState({ step: "coder" }),
      { role: "coder", prompt: "x" },
    );

    expect(outcome.kind).toBe("stopped");
    expect(outcome.state.status).toBe("failed");
    expect(outcome.state.outcome).toContain(
      "Version control was modified during the coder phase",
    );
    expect(outcome.state.costUsd).toBe(0.1);
  });

  it.each(["timeout", "error"] as const)(
    "hands a %s to the limit handling",
    async (status) => {
      const engine = createTestEngine({ loop: { onLimit: "fail" } });
      engine.agents.script("planner", { status });

      const outcome = await runAgentStep(
        engine.ctx,
        newState({ step: "planner" }),
        { role: "planner", prompt: "x" },
      );

      expect(outcome.kind).toBe("stopped");
      expect(outcome.state.status).toBe("failed");
      expect(outcome.state.outcome).toBe(
        `The planner agent did not finish (${status}).`,
      );
      expect(outcome.state.history).toHaveLength(1);
    },
  );

  it("includes the error message in the failure detail", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });
    engine.agents.run = (request) =>
      Promise.resolve({
        sessionId: "s",
        status: "error",
        output: "",
        costUsd: 0,
        durationMs: 0,
        error: `rate limited for ${request.role}`,
      });

    const outcome = await runAgentStep(engine.ctx, newState(), {
      role: "po",
      prompt: "x",
    });

    expect(outcome.state.outcome).toBe(
      "The po agent did not finish (error): rate limited for po",
    );
  });
});
