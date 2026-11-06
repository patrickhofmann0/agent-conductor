import { describe, expect, it } from "vitest";

import { checkResultSchema } from "./check-result.js";

const result = {
  name: "test",
  required: true,
  passed: false,
  exitCode: 1,
  timedOut: false,
  durationMs: 1200,
  output: "1 failed",
};

describe("checkResultSchema", () => {
  it("accepts a finished check", () => {
    expect(checkResultSchema.parse(result)).toEqual(result);
  });

  it("accepts a timed out check without exit code", () => {
    const timedOut = { ...result, exitCode: null, timedOut: true };

    expect(checkResultSchema.parse(timedOut)).toEqual(timedOut);
  });

  it.each([
    ["fractional exit code", { ...result, exitCode: 1.5 }],
    ["negative duration", { ...result, durationMs: -1 }],
    ["unknown key", { ...result, stdout: "" }],
  ])("rejects %s", (_name, input) => {
    expect(checkResultSchema.safeParse(input).success).toBe(false);
  });
});
