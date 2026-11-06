import { describe, expect, it } from "vitest";

import {
  createTestEngine,
  loopState,
} from "../../../../test/fakes/test-engine.js";

import { checksStep, coderStep, testerStep } from "./implementation.js";

import type { Finding } from "../../schemas/verdict.js";

const finding: Finding = {
  id: "f",
  severity: "high",
  target: "coder",
  message: "Fix it",
  source: "reviewer",
};

describe("coderStep", () => {
  it("implements, commits and hands over to the tester", async () => {
    const engine = createTestEngine();
    engine.agents.script("coder", {
      effect: () => {
        engine.vcs.change("src/export.ts");
      },
    });

    const state = await coderStep(engine.ctx, await loopState(engine));

    expect(engine.agents.requests[0]?.prompt).toContain("## Plan\n\n# Plan");
    expect(engine.vcs.commits).toEqual([
      {
        sha: "c1",
        message: "chore(conductor): coder iteration 1",
        files: ["src/export.ts"],
      },
    ]);
    expect(state.step).toBe("tester");
  });

  it("goes straight to the checks when only the coder was asked to act", async () => {
    const engine = createTestEngine();

    const state = await coderStep(
      engine.ctx,
      await loopState(engine, {
        route: "coder",
        iteration: 2,
        findings: [finding],
      }),
    );

    expect(engine.agents.requests[0]?.prompt).toContain("Fix it");
    expect(state.step).toBe("checks");
  });

  it("reverts changes to guardrails and tester files before committing", async () => {
    const engine = createTestEngine({
      guardrails: { paths: ["eslint.config.*"] },
    });
    engine.agents.script("coder", {
      effect: () => {
        engine.vcs.change("src/a.ts", "eslint.config.js", "test/a.test.ts");
      },
    });

    const state = await coderStep(
      engine.ctx,
      await loopState(engine, { testerPaths: ["test/a.test.ts"] }),
    );

    expect(engine.vcs.commits[0]?.files).toEqual(["src/a.ts"]);
    expect(state.violations).toHaveLength(1);
    expect(state.violations[0]?.message).toContain(
      "eslint.config.js, test/a.test.ts",
    );
  });

  it("reverts violations even when the agent failed, without committing", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });
    engine.agents.script("coder", {
      status: "timeout",
      effect: () => {
        engine.vcs.change(".conductor/runs/x");
      },
    });

    const state = await coderStep(engine.ctx, await loopState(engine));

    expect(state.status).toBe("failed");
    expect(engine.vcs.reverts).toHaveLength(1);
    expect(engine.vcs.commits).toEqual([]);
  });
});

describe("testerStep", () => {
  it("records the files the tester touched, commits and moves to the checks", async () => {
    const engine = createTestEngine();
    engine.agents.script("tester", {
      effect: () => {
        engine.vcs.change("test/b.test.ts", "test/a.test.ts");
      },
    });

    const state = await testerStep(
      engine.ctx,
      await loopState(engine, {
        step: "tester",
        testerPaths: ["test/a.test.ts", "eslint.rules.js"],
      }),
    );

    expect(state.testerPaths).toEqual([
      "eslint.rules.js",
      "test/a.test.ts",
      "test/b.test.ts",
    ]);
    expect(engine.vcs.commits.map((commit) => commit.message)).toEqual([
      "chore(conductor): tester iteration 1",
    ]);
    expect(state.step).toBe("checks");
  });

  it("only gets tester findings", async () => {
    const engine = createTestEngine();
    const testerFinding: Finding = {
      ...finding,
      id: "t",
      target: "tester",
      message: "Test edge cases",
    };

    await testerStep(
      engine.ctx,
      await loopState(engine, {
        iteration: 2,
        findings: [finding, testerFinding],
      }),
    );

    expect(engine.agents.requests[0]?.prompt).toContain("Test edge cases");
    expect(engine.agents.requests[0]?.prompt).not.toContain("Fix it");
  });

  it("may change configured guardrails but not framework files", async () => {
    const engine = createTestEngine({
      guardrails: { paths: ["**/*.test.ts"] },
    });
    engine.agents.script("tester", {
      effect: () => {
        engine.vcs.change("a.test.ts", ".conductor/runs/x/state.json");
      },
    });

    const state = await testerStep(engine.ctx, await loopState(engine));

    expect(engine.vcs.commits[0]?.files).toEqual(["a.test.ts"]);
    expect(state.testerPaths).toEqual(["a.test.ts"]);
    expect(state.violations[0]?.target).toBe("tester");
  });

  it("keeps the touched files when the agent failed", async () => {
    const engine = createTestEngine({ loop: { onLimit: "fail" } });
    engine.agents.script("tester", {
      status: "error",
      effect: () => {
        engine.vcs.change("a.test.ts");
      },
    });

    const state = await testerStep(engine.ctx, await loopState(engine));

    expect(state.status).toBe("failed");
    expect(state.testerPaths).toEqual(["a.test.ts"]);
    expect(engine.vcs.commits).toEqual([]);
  });
});

describe("checksStep", () => {
  it("runs every configured check in order and moves to the review", async () => {
    const engine = createTestEngine({
      checks: [
        { name: "test", command: "bun test" },
        { name: "lint", command: "bun lint", required: false },
      ],
    });
    engine.checks.script("lint", { passed: false });

    const state = await checksStep(
      engine.ctx,
      await loopState(engine, { step: "checks" }),
    );

    expect(engine.checks.runs).toEqual(["test", "lint"]);
    expect(
      state.checkResults.map((result) => [
        result.name,
        result.passed,
        result.required,
      ]),
    ).toEqual([
      ["test", true, true],
      ["lint", false, false],
    ]);
    expect(state.step).toBe("review");
  });

  it("works without checks", async () => {
    const engine = createTestEngine();

    const state = await checksStep(
      engine.ctx,
      await loopState(engine, { step: "checks" }),
    );

    expect(state.checkResults).toEqual([]);
    expect(state.step).toBe("review");
  });
});
