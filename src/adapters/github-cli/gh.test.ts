import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createGh, describeGhFailure } from "./gh.js";

async function standIn(script: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "conductor-gh-"));
  const path = join(dir, "gh");
  await writeFile(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return path;
}

describe("createGh", () => {
  it("passes arguments and stdin and returns stdout", async () => {
    const binary = await standIn('echo "$@"; cat');
    const gh = createGh({ cwd: tmpdir(), binary });

    const output = await gh({ args: ["pr", "view", "1"], input: "BODY" });

    expect(output).toBe("pr view 1\nBODY");
  });

  it("explains failures with stderr", async () => {
    const binary = await standIn('echo "HTTP 404: Not Found" >&2; exit 1');
    const gh = createGh({ cwd: tmpdir(), binary });

    await expect(gh({ args: ["api", "x"] })).rejects.toThrow(
      "Not found on GitHub.\ngh api x failed: HTTP 404: Not Found",
    );
  });

  it("falls back to the error message without stderr", async () => {
    const binary = await standIn("exit 3");
    const gh = createGh({ cwd: tmpdir(), binary });

    await expect(gh({ args: ["x"] })).rejects.toThrow(/^gh x failed: /);
  });

  it("says when gh is missing", async () => {
    const gh = createGh({ cwd: tmpdir(), binary: "/nonexistent/gh" });

    await expect(gh({ args: [] })).rejects.toThrow("gh is not installed");
  });
});

describe("describeGhFailure", () => {
  it("adds hints for authentication and rate limits", () => {
    expect(
      describeGhFailure(["api"], "To get started, run: gh auth login"),
    ).toMatch(/^gh is not authenticated/);
    expect(describeGhFailure(["api"], "API rate limit exceeded")).toMatch(
      /^GitHub rate limit exceeded/,
    );
  });

  it("keeps other failures as they are", () => {
    expect(describeGhFailure(["pr", "edit"], "boom")).toBe(
      "gh pr edit failed: boom",
    );
  });
});
