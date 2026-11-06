import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  loopState,
  RUN_ID,
} from "../../../../test/fakes/test-engine.js";

import { reviewStep } from "./review.js";

import type { CheckResult } from "../../schemas/check-result.js";
import type { Finding } from "../../schemas/verdict.js";

const finding: Finding = {
  id: "f1",
  severity: "high",
  target: "tester",
  message: "Weak test",
  source: "reviewer",
};
const violation: Finding = {
  ...finding,
  id: "v1",
  target: "coder",
  source: "framework",
};
const failedCheck: CheckResult = {
  name: "test",
  required: true,
  passed: false,
  exitCode: 1,
  timedOut: false,
  durationMs: 1,
  output: "1 failed",
};

function changesRequested(
  route: string,
  findings: Finding[] = [finding],
): string {
  return `\`\`\`json\n${JSON.stringify({ verdict: "changes_requested", route, summary: "Needs work", findings })}\n\`\`\``;
}

describe("reviewStep", () => {
  it("gives the reviewer documents, diff, checks and violations", async () => {
    const engine = createTestEngine();

    await reviewStep(
      engine.ctx,
      await loopState(engine, {
        step: "review",
        checkResults: [failedCheck],
        violations: [violation],
      }),
    );

    const prompt = engine.agents.requests[0]?.prompt ?? "";
    expect(prompt).toContain("## Requirements\n\n# Requirements");
    expect(prompt).toContain(engine.vcs.diffText);
    expect(prompt).toContain("- test (required): FAILED");
    expect(prompt).toContain("[high] v1");
  });

  it("finishes on approval and stores the review", async () => {
    const engine = createTestEngine();

    const state = await reviewStep(
      engine.ctx,
      await loopState(engine, { step: "review", findings: [finding] }),
    );

    expect(state).toMatchObject({
      step: "finalize",
      findings: [],
      lastVerdict: { verdict: "approve" },
    });
    expect(
      JSON.parse(engine.store.artifact(RUN_ID, "review-1.json") ?? ""),
    ).toMatchObject({ verdict: "approve" });
    expect(engine.vcs.commits.map((commit) => commit.message)).toEqual([
      "chore(conductor): review iteration 1",
    ]);
  });

  it("starts the next iteration with the requested route, findings and violations", async () => {
    const engine = createTestEngine();
    engine.agents.script("reviewer", { output: changesRequested("tester") });

    const state = await reviewStep(
      engine.ctx,
      await loopState(engine, { step: "review", violations: [violation] }),
    );

    expect(state).toMatchObject({
      step: "tester",
      iteration: 2,
      route: "tester",
      violations: [],
    });
    expect(state.findings.map((item) => item.id)).toEqual(["f1", "v1"]);
    expect(state.lastVerdict?.verdict).toBe("changes_requested");
  });

  it("does not accept an approval while a required check fails", async () => {
    const engine = createTestEngine();

    const state = await reviewStep(
      engine.ctx,
      await loopState(engine, { step: "review", checkResults: [failedCheck] }),
    );

    expect(state).toMatchObject({
      step: "coder",
      iteration: 2,
      route: "coder",
    });
    expect(state.findings.map((item) => item.id)).toEqual([
      "required-checks-failed",
    ]);
    expect(engine.store.artifact(RUN_ID, "review-1.json")).toContain(
      "changes_requested",
    );
  });

  it("applies the iteration limit and keeps the open findings", async () => {
    const engine = createTestEngine({ loop: { maxIterations: 2 } });
    engine.agents.script("reviewer", { output: changesRequested("coder") });

    const state = await reviewStep(
      engine.ctx,
      await loopState(engine, { step: "review", iteration: 2 }),
    );

    expect(state).toMatchObject({
      step: "finalize",
      needsHuman: true,
      iteration: 2,
      findings: [finding],
    });
    expect(state.outcome).toContain("Iteration limit reached: 2 of 2");
  });

  it("continues with the next iteration when a human grants more", async () => {
    const engine = createTestEngine({
      loop: { maxIterations: 1, onLimit: "ask" },
    });
    engine.agents.script("reviewer", { output: changesRequested("both") });
    engine.gates.decideLimit({ kind: "continue" });

    const state = await reviewStep(
      engine.ctx,
      await loopState(engine, { step: "review" }),
    );

    expect(state).toMatchObject({
      step: "coder",
      iteration: 2,
      route: "both",
      extensions: 1,
    });
  });

  it("returns the stopped state when no verdict could be obtained", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });
    engine.agents.script("reviewer", { status: "error" });

    const state = await reviewStep(
      engine.ctx,
      await loopState(engine, { step: "review" }),
    );

    expect(state.status).toBe("failed");
    expect(engine.vcs.commits).toEqual([]);
  });
});
