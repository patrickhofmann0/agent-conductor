import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  loopState,
  newState,
  RUN_ID,
} from "../../../../test/fakes/test-engine.js";

import {
  loadDocuments,
  loadImplementationInput,
  requireArtifact,
  reviewArtifact,
} from "./artifacts.js";

import type { Finding } from "../../schemas/verdict.js";

describe("reviewArtifact", () => {
  it("names the review file after the iteration", () => {
    expect(reviewArtifact(3)).toBe("review-3.json");
  });
});

describe("requireArtifact", () => {
  it("returns a stored artifact", async () => {
    const engine = createTestEngine();
    await engine.store.writeArtifact(RUN_ID, "plan.md", "Plan");

    await expect(
      requireArtifact(engine.ctx, newState(), "plan.md"),
    ).resolves.toBe("Plan");
  });

  it("fails clearly when the artifact is missing", async () => {
    const engine = createTestEngine();

    await expect(
      requireArtifact(engine.ctx, newState(), "plan.md"),
    ).rejects.toThrow(`Artifact plan.md of run ${RUN_ID} is missing.`);
  });
});

describe("loadDocuments", () => {
  it("loads requirements and plan", async () => {
    const engine = createTestEngine();
    const state = await loopState(engine);

    await expect(loadDocuments(engine.ctx, state)).resolves.toEqual({
      requirements: "# Requirements",
      plan: "# Plan",
    });
  });
});

describe("loadImplementationInput", () => {
  it("combines documents with iteration, findings and check results", async () => {
    const engine = createTestEngine();
    const finding: Finding = {
      id: "f",
      severity: "low",
      target: "coder",
      message: "m",
      source: "reviewer",
    };
    const state = await loopState(engine, {
      iteration: 2,
      findings: [finding],
    });

    await expect(loadImplementationInput(engine.ctx, state)).resolves.toEqual({
      requirements: "# Requirements",
      plan: "# Plan",
      iteration: 2,
      findings: [finding],
      checkResults: [],
    });
  });
});
