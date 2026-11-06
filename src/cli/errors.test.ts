import { describe, expect, it } from "vitest";

import { describeError } from "./errors.js";

describe("describeError", () => {
  it("uses the message of an Error", () => {
    expect(describeError(new TypeError("bad option"))).toBe("bad option");
  });

  it.each([
    ["a string", "a string"],
    [42, "42"],
    [undefined, "undefined"],
  ])("stringifies non-Error value %j", (value, expected) => {
    expect(describeError(value)).toBe(expected);
  });
});
