import { describe, expect, it } from "vitest";

import { isAtLeast, verifyGh } from "./preflight.js";

import type { GhCommand } from "./gh.js";

function recordingGh(version: string): {
  gh: (command: GhCommand) => Promise<string>;
  calls: string[][];
} {
  const calls: string[][] = [];
  return {
    calls,
    gh: (command) => {
      calls.push([...command.args]);
      return Promise.resolve(version);
    },
  };
}

describe("isAtLeast", () => {
  it("compares versions numerically", () => {
    expect(isAtLeast("2.40.0", "2.40.0")).toBe(true);
    expect(isAtLeast("2.103.3", "2.40.0")).toBe(true);
    expect(isAtLeast("3.0.0", "2.40.0")).toBe(true);
    expect(isAtLeast("2.39.9", "2.40.0")).toBe(false);
    expect(isAtLeast("1.99.0", "2.40.0")).toBe(false);
    expect(isAtLeast("2.40", "2.40.1")).toBe(false);
  });
});

describe("verifyGh", () => {
  it("checks the version and the login", async () => {
    const { gh, calls } = recordingGh(
      "gh version 2.103.3 (2026-10-26)\nhttps://github.com/cli/cli\n",
    );

    await verifyGh(gh);

    expect(calls).toEqual([["--version"], ["auth", "status"]]);
  });

  it("rejects old or unknown versions", async () => {
    await expect(
      verifyGh(recordingGh("gh version 2.20.0 (2022-11-01)\n").gh),
    ).rejects.toThrow(
      "gh 2.40.0 or newer is required; found: gh version 2.20.0 (2022-11-01)",
    );
    await expect(verifyGh(recordingGh("").gh)).rejects.toThrow("found: ");
  });
});
