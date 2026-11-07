import { describe, expect, it } from "vitest";

import { truncateOutput } from "./truncate.js";

describe("truncateOutput", () => {
  it("keeps short output", () => {
    expect(truncateOutput("all good\n", 100)).toBe("all good\n");
  });

  it("keeps output of exactly the limit", () => {
    expect(truncateOutput("abcd", 4)).toBe("abcd");
  });

  it("removes terminal colors", () => {
    expect(truncateOutput("\u001b[31mFAIL\u001b[39m a.test.ts", 100)).toBe(
      "FAIL a.test.ts",
    );
  });

  it("keeps a quarter from the start and the rest from the end", () => {
    const text = `${"a".repeat(50)}${"b".repeat(100)}${"c".repeat(50)}`;
    expect(truncateOutput(text, 100)).toBe(
      `${"a".repeat(25)}\n… 100 characters omitted …\n${"b".repeat(25)}${"c".repeat(50)}`,
    );
  });
});
