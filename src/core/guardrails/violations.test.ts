import { describe, expect, it } from "vitest";

import { guardrailViolations, violationFinding } from "./violations.js";

describe("guardrailViolations", () => {
  it("reports files matching guardrail patterns", () => {
    expect(
      guardrailViolations({
        changed: ["src/a.ts", "src/a.test.ts", "eslint.config.js"],
        patterns: ["**/*.test.ts", "eslint.config.*"],
        testerPaths: [],
      }),
    ).toEqual(["eslint.config.js", "src/a.test.ts"]);
  });

  it("reports files the tester created or changed", () => {
    expect(
      guardrailViolations({
        changed: ["src/a.ts", "test/helpers/csv.ts"],
        patterns: [],
        testerPaths: ["test/helpers/csv.ts"],
      }),
    ).toEqual(["test/helpers/csv.ts"]);
  });

  it("always protects framework files", () => {
    expect(
      guardrailViolations({
        changed: [".conductor/runs/r1/state.json", "src/a.ts"],
        patterns: [],
        testerPaths: [],
      }),
    ).toEqual([".conductor/runs/r1/state.json"]);
  });

  it("allows ordinary changes", () => {
    expect(
      guardrailViolations({
        changed: ["src/a.ts"],
        patterns: ["**/*.test.ts"],
        testerPaths: [],
      }),
    ).toEqual([]);
  });
});

describe("violationFinding", () => {
  it("creates a high-severity framework finding for the agent", () => {
    const finding = violationFinding({
      paths: ["a.test.ts", "eslint.config.js"],
      iteration: 2,
      target: "coder",
    });

    expect(finding).toMatchObject({
      id: "guardrail-violation-coder-2",
      severity: "high",
      target: "coder",
      source: "framework",
    });
    expect(finding.message).toContain("The coder changed protected files");
    expect(finding.message).toContain("a.test.ts, eslint.config.js");
  });

  it("can target the tester", () => {
    const finding = violationFinding({
      paths: [".conductor/x"],
      iteration: 1,
      target: "tester",
    });

    expect(finding.id).toBe("guardrail-violation-tester-1");
    expect(finding.target).toBe("tester");
    expect(finding.message).toContain("were reverted");
  });
});
