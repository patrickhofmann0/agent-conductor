import { describe, expect, it } from "vitest";

import { configSchema } from "../schemas/config.js";

import { createRunState } from "./create-state.js";
import { budgetBreach, iterationBreach } from "./limits.js";

const config = configSchema.parse({
  loop: { maxIterations: 3 },
  limits: { maxCostUsd: 2, totalTimeout: "10m" },
});
const base = createRunState({
  runId: "r1",
  input: { kind: "prompt", title: "t", body: "" },
  branch: "b",
  baseCommit: "c",
  startedAt: 0,
});

describe("budgetBreach", () => {
  it("is null below both limits", () => {
    expect(
      budgetBreach(config, { ...base, costUsd: 1.99, activeMs: 599_999 }),
    ).toBeNull();
  });

  it("reports the cost limit when reached", () => {
    expect(budgetBreach(config, { ...base, costUsd: 2 })).toEqual({
      kind: "cost",
      detail: "Cost limit reached: $2.00 of $2.00.",
    });
  });

  it("reports the time limit when reached", () => {
    expect(budgetBreach(config, { ...base, activeMs: 600_000 })).toEqual({
      kind: "time",
      detail: "Time limit reached: 10 min of 10 min.",
    });
  });

  it("checks cost before time", () => {
    expect(
      budgetBreach(config, { ...base, costUsd: 5, activeMs: 900_000 })?.kind,
    ).toBe("cost");
  });

  it("grants another budget per extension", () => {
    const extended = { ...base, extensions: 1 };

    expect(
      budgetBreach(config, { ...extended, costUsd: 3.99, activeMs: 1_199_999 }),
    ).toBeNull();
    expect(budgetBreach(config, { ...extended, costUsd: 4 })?.detail).toBe(
      "Cost limit reached: $4.00 of $4.00.",
    );
    expect(
      budgetBreach(config, { ...extended, activeMs: 1_200_000 })?.detail,
    ).toBe("Time limit reached: 20 min of 20 min.");
  });
});

describe("iterationBreach", () => {
  it("is null while iterations remain", () => {
    expect(iterationBreach(config, { ...base, iteration: 2 })).toBeNull();
  });

  it("reports when the last iteration is used up", () => {
    expect(iterationBreach(config, { ...base, iteration: 3 })).toEqual({
      kind: "iterations",
      detail: "Iteration limit reached: 3 of 3 review rounds without approval.",
    });
  });

  it("does not count iterations started by human feedback", () => {
    expect(
      iterationBreach(config, { ...base, iteration: 4, humanIterations: 2 }),
    ).toBeNull();
    expect(
      iterationBreach(config, { ...base, iteration: 5, humanIterations: 2 }),
    ).toEqual({
      kind: "iterations",
      detail: "Iteration limit reached: 3 of 3 review rounds without approval.",
    });
  });

  it("grants more iterations per extension", () => {
    expect(
      iterationBreach(config, { ...base, iteration: 5, extensions: 1 }),
    ).toBeNull();
    expect(
      iterationBreach(config, { ...base, iteration: 6, extensions: 1 })?.kind,
    ).toBe("iterations");
  });
});
