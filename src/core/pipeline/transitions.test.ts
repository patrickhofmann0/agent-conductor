import { describe, expect, it } from "vitest";

import { configSchema } from "../schemas/config.js";

import { createRunState } from "./create-state.js";
import {
  afterPlanner,
  afterProductOwner,
  enterLoop,
  nextIteration,
  stepAfterCoder,
} from "./transitions.js";

import type { Finding } from "../schemas/verdict.js";

const state = createRunState({
  runId: "r1",
  input: { kind: "prompt", title: "t", body: "" },
  branch: "b",
  baseCommit: "c",
  startedAt: 0,
});
const finding: Finding = {
  id: "f",
  severity: "low",
  target: "coder",
  message: "m",
  source: "reviewer",
};
const withGates = configSchema.parse({});
const withoutGates = configSchema.parse({
  gates: { po: false, planner: false },
});

describe("afterProductOwner", () => {
  it("goes to the gate when enabled", () => {
    expect(afterProductOwner(withGates, state).step).toBe("po_gate");
  });

  it("goes to the planner when the gate is disabled", () => {
    expect(afterProductOwner(withoutGates, state).step).toBe("planner");
  });
});

describe("afterPlanner", () => {
  it("goes to the gate when enabled", () => {
    expect(afterPlanner(withGates, state)).toEqual({
      ...state,
      step: "planner_gate",
    });
  });

  it("enters the loop when the gate is disabled", () => {
    expect(afterPlanner(withoutGates, state)).toEqual(enterLoop(state));
  });
});

describe("enterLoop", () => {
  it("starts iteration 1 with coder and tester and clears findings", () => {
    const entered = enterLoop({
      ...state,
      findings: [finding],
      violations: [finding],
      route: "tester",
    });

    expect(entered).toEqual({
      ...state,
      step: "coder",
      iteration: 1,
      route: "both",
      findings: [],
      violations: [],
    });
  });
});

describe("stepAfterCoder", () => {
  it.each([
    ["coder", "checks"],
    ["both", "tester"],
    ["tester", "tester"],
  ] as const)("after the coder with route %s comes %s", (route, step) => {
    expect(stepAfterCoder(route)).toBe(step);
  });
});

describe("nextIteration", () => {
  const inLoop = { ...enterLoop(state), violations: [finding] };

  it.each([
    ["coder", "coder"],
    ["both", "coder"],
    ["tester", "tester"],
  ] as const)("route %s starts with %s", (route, step) => {
    const next = nextIteration(inLoop, route, [finding]);

    expect(next).toEqual({
      ...inLoop,
      step,
      iteration: 2,
      route,
      findings: [finding],
      violations: [],
    });
  });

  it("copies the findings", () => {
    const findings = [finding];
    const next = nextIteration(inLoop, "coder", findings);

    expect(next.findings).not.toBe(findings);
  });
});
