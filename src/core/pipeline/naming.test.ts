import { describe, expect, it } from "vitest";

import { branchName, formatRunId, slugify } from "./naming.js";

describe("slugify", () => {
  it.each([
    ["Add CSV export", "add-csv-export"],
    ["  Fix: crash on empty input!  ", "fix-crash-on-empty-input"],
    ["Änderung für Bilder", "anderung-fur-bilder"],
    ["API v2 / OAuth", "api-v2-oauth"],
    ["!!!", "feature"],
    ["", "feature"],
  ])("slugifies %j", (title, expected) => {
    expect(slugify(title)).toBe(expected);
  });

  it("limits the length without a trailing dash", () => {
    const slug = slugify("a".repeat(39) + " bbbbbbbb");

    expect(slug).toBe("a".repeat(39));
  });

  it("keeps exactly 40 characters", () => {
    expect(slugify("b".repeat(45))).toBe("b".repeat(40));
  });
});

describe("formatRunId", () => {
  it("formats the UTC timestamp and suffix", () => {
    expect(formatRunId(Date.UTC(2026, 10, 6, 21, 30, 45), "k3x9")).toBe(
      "20261106-213045-k3x9",
    );
  });

  it.each(["abc", "ABCD", "abcdefghi", "ab-cd"])(
    "rejects the suffix %j",
    (suffix) => {
      expect(() => formatRunId(0, suffix)).toThrow("Run id suffix");
    },
  );

  it.each(["abcd", "abcdefgh"])("accepts the suffix %j", (suffix) => {
    expect(formatRunId(0, suffix)).toBe(`19700101-000000-${suffix}`);
  });
});

describe("branchName", () => {
  it("combines prefix, run id and slug", () => {
    expect(
      branchName("conductor/", "20261106-213045-k3x9", "Add CSV export"),
    ).toBe("conductor/20261106-213045-k3x9-add-csv-export");
  });
});
