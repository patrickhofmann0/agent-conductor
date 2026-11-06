import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  newState,
  RUN_ID,
} from "../../../../test/fakes/test-engine.js";

import { createDocumentStep } from "./document-step.js";

const step = createDocumentStep({
  role: "po",
  artifact: "doc.md",
  task: (_ctx, _state, revision) =>
    Promise.resolve(`task ${JSON.stringify(revision)}`),
  next: (_config, state) => ({ ...state, step: "planner" }),
});

describe("createDocumentStep", () => {
  it("stores the answer, commits and moves on", async () => {
    const engine = createTestEngine();
    engine.agents.script("po", { output: "The doc" });

    const state = await step(engine.ctx, newState());

    expect(engine.store.artifact(RUN_ID, "doc.md")).toBe("The doc");
    expect(engine.vcs.commits.map((commit) => commit.message)).toEqual([
      "chore(conductor): po wrote doc.md",
    ]);
    expect(state.step).toBe("planner");
    expect(state.history).toHaveLength(1);
  });

  it("passes no revision context without feedback", async () => {
    const engine = createTestEngine();

    await step(engine.ctx, newState());

    expect(engine.agents.requests[0]?.prompt).toBe("task {}");
  });

  it("passes feedback and the previous document, then consumes the feedback", async () => {
    const engine = createTestEngine();
    await engine.store.writeArtifact(RUN_ID, "doc.md", "Old doc");

    const state = await step(engine.ctx, newState({ gateFeedback: "Shorter" }));

    expect(engine.agents.requests[0]?.prompt).toBe(
      'task {"feedback":"Shorter","previous":"Old doc"}',
    );
    expect(state.gateFeedback).toBeNull();
  });

  it("stops without storing or committing when the agent fails", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });
    engine.agents.script("po", { status: "timeout" });

    const state = await step(engine.ctx, newState({ gateFeedback: "Shorter" }));

    expect(state.status).toBe("failed");
    expect(state.gateFeedback).toBe("Shorter");
    expect(engine.store.artifact(RUN_ID, "doc.md")).toBeUndefined();
    expect(engine.vcs.commits).toEqual([]);
  });
});
