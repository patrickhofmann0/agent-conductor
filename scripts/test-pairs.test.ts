import { describe, expect, it } from "vitest";

import { findSourcesWithoutTests } from "./test-pairs.js";

describe("findSourcesWithoutTests", () => {
  it("accepts sources that have a sibling test", () => {
    expect(findSourcesWithoutTests(["core/a.ts", "core/a.test.ts"])).toEqual(
      [],
    );
  });

  it("reports sources without a sibling test, sorted", () => {
    expect(
      findSourcesWithoutTests([
        "core/b.ts",
        "core/a.ts",
        "core/c.ts",
        "core/c.test.ts",
      ]),
    ).toEqual(["core/a.ts", "core/b.ts"]);
  });

  it("does not accept a test in another directory", () => {
    expect(findSourcesWithoutTests(["core/a.ts", "cli/a.test.ts"])).toEqual([
      "core/a.ts",
    ]);
  });

  it.each([
    "cli/index.ts",
    "index.ts",
    "core/x.d.ts",
    "core/ports/runner.types.ts",
  ])("exempts %s", (file) => {
    expect(findSourcesWithoutTests([file])).toEqual([]);
  });

  it("ignores non-TypeScript files", () => {
    expect(
      findSourcesWithoutTests(["core/readme.md", "core/data.json"]),
    ).toEqual([]);
  });

  it("normalizes Windows separators", () => {
    expect(findSourcesWithoutTests(["core\\a.ts", "core\\a.test.ts"])).toEqual(
      [],
    );
  });
});
