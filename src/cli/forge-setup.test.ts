import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createOpenGithub } from "./forge-setup.js";

async function standIn(script: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "conductor-gh-"));
  const path = join(dir, "gh");
  await writeFile(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return path;
}

describe("createOpenGithub", () => {
  it("returns a forge when gh is ready", async () => {
    const binary = await standIn('echo "gh version 2.50.0 (2024-06-01)"');

    const forge = await createOpenGithub(binary)(tmpdir());

    expect(forge.closingReference("#1")).toBe("Closes #1");
  });

  it("fails when gh is not logged in", async () => {
    const binary = await standIn(
      'if [ "$1" = auth ]; then echo "You are not logged into any GitHub hosts. To log in, run: gh auth login" >&2; exit 1; fi\necho "gh version 2.50.0"',
    );

    await expect(createOpenGithub(binary)(tmpdir())).rejects.toThrow(
      "gh is not authenticated",
    );
  });
});
