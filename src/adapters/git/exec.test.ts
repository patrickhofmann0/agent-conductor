import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { git, splitNul } from "./exec.js";

describe("git", () => {
  it("returns stdout", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conductor-git-"));
    await git({ cwd, args: ["init", "-q"] });
    const output = await git({
      cwd,
      args: ["config", "--get", "user.name"],
      env: { GIT_CONFIG_PARAMETERS: "'user.name'='Conductor'" },
    });
    expect(output.trim()).toBe("Conductor");
  });

  it("rejects with the command and stderr", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conductor-git-"));
    await expect(
      git({ cwd, args: ["rev-parse", "--verify", "nope"] }),
    ).rejects.toThrow(/^git rev-parse --verify nope failed: fatal: /);
  });

  it("falls back to the error message without stderr", async () => {
    await expect(
      git({ cwd: "/nonexistent-directory", args: ["status"] }),
    ).rejects.toThrow(/^git status failed: .*ENOENT/);
  });
});

describe("splitNul", () => {
  it("splits entries and drops empty ones", () => {
    expect(splitNul("a.ts\0b c.ts\0")).toEqual(["a.ts", "b c.ts"]);
    expect(splitNul("")).toEqual([]);
  });
});
