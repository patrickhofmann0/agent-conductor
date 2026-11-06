import { describe, expect, it } from "vitest";

import { findingSchema, verdictSchema } from "./verdict.js";

const finding = {
  id: "f1",
  severity: "high",
  target: "coder",
  message: "Missing null check",
};

describe("findingSchema", () => {
  it("defaults the source to reviewer", () => {
    expect(findingSchema.parse(finding)).toEqual({
      ...finding,
      source: "reviewer",
    });
  });

  it("accepts optional location and suggestion", () => {
    const full = {
      ...finding,
      file: "src/a.ts",
      line: 3,
      suggestion: "Add a guard",
      source: "framework",
    };

    expect(findingSchema.parse(full)).toEqual(full);
  });

  it.each(["low", "medium", "high", "critical"])(
    "accepts the severity %s",
    (severity) => {
      expect(findingSchema.parse({ ...finding, severity }).severity).toBe(
        severity,
      );
    },
  );

  it.each([
    ["unknown severity", { ...finding, severity: "blocker" }],
    ["unknown target", { ...finding, target: "planner" }],
    ["empty message", { ...finding, message: "" }],
    ["line zero", { ...finding, line: 0 }],
    ["missing id", { severity: "low", target: "coder", message: "x" }],
  ])("rejects %s", (_name, input) => {
    expect(findingSchema.safeParse(input).success).toBe(false);
  });
});

describe("verdictSchema", () => {
  it("parses an approval with defaults", () => {
    expect(
      verdictSchema.parse({ verdict: "approve", summary: "Looks good" }),
    ).toEqual({
      verdict: "approve",
      route: "both",
      summary: "Looks good",
      findings: [],
    });
  });

  it("strips unknown keys added by the model", () => {
    const parsed = verdictSchema.parse({
      verdict: "changes_requested",
      route: "tester",
      summary: "Tests are weak",
      findings: [finding],
      confidence: 0.9,
    });

    expect(parsed).toEqual({
      verdict: "changes_requested",
      route: "tester",
      summary: "Tests are weak",
      findings: [{ ...finding, source: "reviewer" }],
    });
  });

  it.each([
    ["unknown verdict", { verdict: "reject", summary: "x" }],
    ["unknown route", { verdict: "approve", route: "planner", summary: "x" }],
    ["missing summary", { verdict: "approve" }],
    ["invalid finding", { verdict: "approve", summary: "x", findings: [{}] }],
  ])("rejects %s", (_name, input) => {
    expect(verdictSchema.safeParse(input).success).toBe(false);
  });
});
