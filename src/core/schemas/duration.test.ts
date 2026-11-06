import { describe, expect, it } from "vitest";

import { durationSchema, parseDuration } from "./duration.js";

describe("parseDuration", () => {
  it.each([
    ["1s", 1_000],
    ["90s", 90_000],
    ["20m", 1_200_000],
    ["2h", 7_200_000],
    ["1h30m", 5_400_000],
    ["1h2m3s", 3_723_000],
    ["0h5m", 300_000],
  ])("parses %s", (text, expected) => {
    expect(parseDuration(text)).toBe(expected);
  });

  it.each(["", "0s", "0h0m", "5", "5x", "m5", "1m1h", " 5m", "1.5h", "-5m"])(
    "rejects %j",
    (text) => {
      expect(parseDuration(text)).toBeNull();
    },
  );
});

describe("durationSchema", () => {
  it("transforms valid durations to milliseconds", () => {
    expect(durationSchema.parse("15m")).toBe(900_000);
  });

  it("explains the expected format", () => {
    const result = durationSchema.safeParse("15 minutes");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('"20m"');
  });

  it.each([
    ["12h", 43_200_000],
    ["100s", 100_000],
    ["12h30m15s", 45_015_000],
  ])("accepts multi-digit amounts like %s", (text, expected) => {
    expect(durationSchema.parse(text)).toBe(expected);
  });

  it("rejects zero durations", () => {
    const result = durationSchema.safeParse("0m");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Duration must be greater than zero.",
    );
  });

  it("rejects an empty string", () => {
    expect(durationSchema.safeParse("").success).toBe(false);
  });
});
