import { describe, expect, it } from "vitest";

import { parseConfig } from "./parse.js";

describe("parseConfig", () => {
  it.each([[undefined], [null], [{}]])("returns defaults for %j", (raw) => {
    const result = parseConfig(raw);

    expect(result.ok).toBe(true);
    expect(result.ok && result.config.loop.maxIterations).toBe(3);
  });

  it("returns the validated config", () => {
    const result = parseConfig({ language: "de", loop: { maxIterations: 2 } });

    if (!result.ok) throw new Error(result.errors.join());
    expect(result.config.language).toBe("de");
    expect(result.config.loop).toEqual({
      maxIterations: 2,
      onLimit: "draft_pr",
    });
  });

  it("reports every problem with its path", () => {
    const result = parseConfig({
      loop: { maxIterations: 0 },
      limits: { phaseTimeout: "soon" },
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        "loop.maxIterations: Too small: expected number to be >=1",
        'limits.phaseTimeout: Use a duration like "90s", "20m" or "1h30m".',
      ],
    });
  });

  it("reports problems with array indices", () => {
    const result = parseConfig({ checks: [{ name: "a", command: "" }] });

    expect(result).toEqual({
      ok: false,
      errors: [
        "checks.0.command: Too small: expected string to have >=1 characters",
      ],
    });
  });

  it("reports root-level problems without a path", () => {
    const result = parseConfig("version: 1");

    expect(result).toEqual({
      ok: false,
      errors: ["Invalid input: expected object, received string"],
    });
  });
});
