import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  newState,
} from "../../../../test/fakes/test-engine.js";

import { revertViolations } from "./protect.js";

const request = {
  before: "base",
  target: "coder" as const,
  patterns: ["**/*.test.ts"],
  testerPaths: ["test/helper.ts"],
};

describe("revertViolations", () => {
  it("leaves allowed changes alone", async () => {
    const engine = createTestEngine();
    engine.vcs.change("src/a.ts");
    const state = newState({ iteration: 1 });

    expect(await revertViolations(engine.ctx, state, request)).toBe(state);
    expect(engine.vcs.reverts).toEqual([]);
    expect(engine.reporter.events).toEqual([]);
  });

  it("reverts protected changes, reports them and records a finding", async () => {
    const engine = createTestEngine();
    engine.vcs.change("src/a.ts", "src/a.test.ts", "test/helper.ts");

    const state = await revertViolations(
      engine.ctx,
      newState({ iteration: 2 }),
      request,
    );

    expect(engine.vcs.reverts).toEqual([
      { paths: ["src/a.test.ts", "test/helper.ts"], commit: "base" },
    ]);
    expect(engine.vcs.workingChanges).toEqual(["src/a.ts"]);
    expect(engine.reporter.events).toEqual([
      {
        type: "guardrail_reverted",
        paths: ["src/a.test.ts", "test/helper.ts"],
      },
    ]);
    expect(state.violations).toEqual([
      expect.objectContaining({
        id: "guardrail-violation-coder-2",
        target: "coder",
        source: "framework",
      }),
    ]);
  });

  it("keeps earlier violations of the iteration", async () => {
    const engine = createTestEngine();
    engine.vcs.change(".conductor/runs/x/plan.md");
    const earlier = {
      id: "e",
      severity: "low" as const,
      target: "coder" as const,
      message: "m",
      source: "framework" as const,
    };

    const state = await revertViolations(
      engine.ctx,
      newState({ iteration: 1, violations: [earlier] }),
      {
        ...request,
        target: "tester",
      },
    );

    expect(state.violations.map((finding) => finding.id)).toEqual([
      "e",
      "guardrail-violation-tester-1",
    ]);
  });
});
