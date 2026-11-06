import { describe, expect, it } from "vitest";

import { enforceRequiredChecks, mergeFindings } from "./enforce.js";

import type { CheckResult } from "../schemas/check-result.js";
import type { Finding, Verdict } from "../schemas/verdict.js";

const approve: Verdict = {
  verdict: "approve",
  route: "both",
  summary: "ok",
  findings: [],
};
const passed: CheckResult = {
  name: "test",
  required: true,
  passed: true,
  exitCode: 0,
  timedOut: false,
  durationMs: 1,
  output: "",
};
const finding: Finding = {
  id: "a",
  severity: "low",
  target: "tester",
  message: "m",
  source: "reviewer",
};

describe("enforceRequiredChecks", () => {
  it("keeps an approval when required checks pass", () => {
    expect(enforceRequiredChecks(approve, [passed])).toBe(approve);
  });

  it("keeps an approval when only optional checks fail", () => {
    const optional = {
      ...passed,
      name: "lint",
      required: false,
      passed: false,
    };

    expect(enforceRequiredChecks(approve, [passed, optional])).toBe(approve);
  });

  it("keeps a change request unchanged", () => {
    const changes: Verdict = {
      ...approve,
      verdict: "changes_requested",
      route: "tester",
    };

    expect(enforceRequiredChecks(changes, [{ ...passed, passed: false }])).toBe(
      changes,
    );
  });

  it("turns an approval with failed required checks into a change request for the coder", () => {
    const result = enforceRequiredChecks({ ...approve, findings: [finding] }, [
      { ...passed, passed: false },
      { ...passed, name: "build", passed: false },
      { ...passed, name: "lint", passed: true },
    ]);

    expect(result.verdict).toBe("changes_requested");
    expect(result.route).toBe("coder");
    expect(result.summary).toBe("ok");
    expect(result.findings).toEqual([
      finding,
      expect.objectContaining({
        id: "required-checks-failed",
        severity: "high",
        target: "coder",
        source: "framework",
      }),
    ]);
    expect(result.findings[1]?.message).toContain(
      "Required checks failed: test, build.",
    );
  });
});

describe("mergeFindings", () => {
  it("concatenates lists and drops duplicate ids", () => {
    const b = { ...finding, id: "b" };

    expect(
      mergeFindings([finding, b], [{ ...finding, message: "dup" }]),
    ).toEqual([finding, b]);
  });

  it("returns an empty list for no input", () => {
    expect(mergeFindings()).toEqual([]);
  });
});
