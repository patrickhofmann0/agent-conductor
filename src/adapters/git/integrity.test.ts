import { chmod, rm } from "node:fs/promises";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  createTempRepo,
  type TempRepo,
} from "../../../test/support/temp-repo.js";

import { integritySnapshot } from "./integrity.js";

let repo: TempRepo;
let before: string;

beforeEach(async () => {
  repo = await createTempRepo();
  before = await integritySnapshot(repo.dir);
});

describe("integritySnapshot", () => {
  it("is stable while nothing changes", async () => {
    expect(await integritySnapshot(repo.dir)).toBe(before);
  });

  it("ignores changes to working tree files", async () => {
    await repo.write("src/a.ts", "export {};\n");
    expect(await integritySnapshot(repo.dir)).toBe(before);
  });

  it.each<[string, (r: TempRepo) => Promise<void> | void]>([
    ["a commit", (r) => void r.git("commit", "-q", "--allow-empty", "-m", "x")],
    ["a branch switch", (r) => void r.git("switch", "-q", "-c", "other")],
    ["a detached HEAD", (r) => void r.git("switch", "-q", "--detach")],
    ["a new tag", (r) => void r.git("tag", "v1")],
    ["a config change", (r) => void r.git("config", "core.hooksPath", "x")],
    [
      "a new hook",
      (r) => r.write(".git/hooks/pre-commit", "#!/bin/sh\nexit 0\n"),
    ],
    [
      "a hook mode change",
      async (r) => {
        await r.write(".git/hooks/post-commit", "#!/bin/sh\n");
        before = await integritySnapshot(r.dir);
        await chmod(join(r.dir, ".git/hooks/post-commit"), 0o755);
      },
    ],
  ])("changes after %s", async (_name, change) => {
    await change(repo);
    expect(await integritySnapshot(repo.dir)).not.toBe(before);
  });

  it("notices removed config and hooks", async () => {
    await rm(join(repo.dir, ".git/hooks"), { recursive: true, force: true });
    const withoutHooks = await integritySnapshot(repo.dir);
    expect(withoutHooks).not.toBe(before);
    await rm(join(repo.dir, ".git/config"));
    await expect(integritySnapshot(repo.dir)).resolves.not.toBe(withoutHooks);
  });
});
