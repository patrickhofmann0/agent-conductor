import { describe, expect, it } from "vitest";

import {
  formatCheckResults,
  formatFindings,
  joinSections,
  section,
} from "./format.js";

import type { CheckResult } from "../schemas/check-result.js";
import type { Finding } from "../schemas/verdict.js";

const finding: Finding = {
  id: "null-check",
  severity: "high",
  target: "coder",
  message: "Missing null check",
  source: "reviewer",
};

const check: CheckResult = {
  name: "test",
  required: true,
  passed: true,
  exitCode: 0,
  timedOut: false,
  durationMs: 10,
  output: "all good",
};

describe("section", () => {
  it("renders a heading and trimmed content", () => {
    expect(section("Plan", "\n  step 1\n")).toBe("## Plan\n\nstep 1");
  });

  it("marks empty content", () => {
    expect(section("Plan", "  ")).toBe("## Plan\n\n(empty)");
  });
});

describe("joinSections", () => {
  it("joins sections with blank lines and skips null", () => {
    expect(joinSections(["a", null, "b"])).toBe("a\n\nb");
  });
});

describe("formatFindings", () => {
  it("says None for no findings", () => {
    expect(formatFindings([])).toBe("None.");
  });

  it("renders severity, id and message", () => {
    expect(formatFindings([finding])).toBe(
      "- [high] null-check: Missing null check",
    );
  });

  it("renders file, line and suggestion", () => {
    expect(
      formatFindings([
        { ...finding, file: "src/a.ts", line: 4, suggestion: "Guard it" },
      ]),
    ).toBe(
      "- [high] null-check (src/a.ts:4): Missing null check\n  Suggestion: Guard it",
    );
  });

  it("renders a file without line", () => {
    expect(formatFindings([{ ...finding, file: "src/a.ts" }])).toBe(
      "- [high] null-check (src/a.ts): Missing null check",
    );
  });

  it("renders one line per finding", () => {
    expect(
      formatFindings([finding, { ...finding, id: "other" }]).split("\n"),
    ).toHaveLength(2);
  });
});

describe("formatCheckResults", () => {
  it("explains when no checks exist", () => {
    expect(formatCheckResults([])).toBe("No checks are configured.");
  });

  it("lists passed checks without output", () => {
    expect(formatCheckResults([check])).toBe("- test (required): passed");
  });

  it("includes the output of failed checks", () => {
    expect(
      formatCheckResults([
        { ...check, passed: false, exitCode: 1, output: " 1 failed \n" },
      ]),
    ).toBe("- test (required): FAILED\n\n```text\n1 failed\n```");
  });

  it("omits whitespace-only output of failed checks", () => {
    expect(
      formatCheckResults([{ ...check, passed: false, output: " \n " }]),
    ).toBe("- test (required): FAILED");
  });

  it("marks timeouts and optional checks", () => {
    expect(
      formatCheckResults([
        {
          ...check,
          name: "lint",
          required: false,
          passed: false,
          timedOut: true,
          exitCode: null,
          output: "",
        },
      ]),
    ).toBe("- lint (optional): timed out");
  });

  it("renders one entry per check", () => {
    expect(formatCheckResults([check, { ...check, name: "lint" }])).toBe(
      "- test (required): passed\n- lint (required): passed",
    );
  });
});
