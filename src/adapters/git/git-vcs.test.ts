import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  createTempRepo,
  type TempRepo,
} from "../../../test/support/temp-repo.js";

import { createGitVcs, type GitVcs } from "./git-vcs.js";

let repo: TempRepo;
let vcs: GitVcs;
let base: string;

beforeEach(async () => {
  repo = await createTempRepo();
  vcs = createGitVcs(repo.dir);
  base = await vcs.head();
});

function read(path: string): Promise<string> {
  return readFile(join(repo.dir, path), "utf8");
}

describe("createGitVcs", () => {
  it("creates and checks out a branch and returns the base commit", async () => {
    expect(await vcs.createBranch("conductor/x", "main")).toBe(base);
    expect(repo.git("branch", "--show-current")).toBe("conductor/x");
  });

  it("fails to branch from an unknown base", async () => {
    await expect(vcs.createBranch("x", "missing")).rejects.toThrow(/rev-parse/);
  });

  it("lists committed, modified, deleted and untracked files", async () => {
    await repo.write("committed.ts", "1");
    await vcs.commit("chore(conductor): coder");
    await repo.write("README.md", "changed");
    await repo.write("dir/new file.ts", "2");
    expect([...(await vcs.changedFiles(base))].sort()).toEqual([
      "README.md",
      "committed.ts",
      "dir/new file.ts",
    ]);
    await rm(join(repo.dir, "README.md"));
    expect(await vcs.changedFiles(base)).toContain("README.md");
  });

  it("does not touch the real index", async () => {
    await repo.write("new.ts", "x");
    await vcs.changedFiles(base);
    await vcs.diff(base);
    expect(repo.git("status", "--porcelain")).toBe("?? new.ts");
  });

  it("diffs including untracked files", async () => {
    await repo.write("new.ts", "export const a = 1;\n");
    const diff = await vcs.diff(base);
    expect(diff).toContain("diff --git a/new.ts b/new.ts");
    expect(diff).toContain("+export const a = 1;");
  });

  it("reverts changed files and deletes files that did not exist", async () => {
    await repo.write("README.md", "changed");
    await repo.write("new.ts", "x");
    await repo.write("keep.ts", "keep");
    await vcs.revertPaths(["README.md", "new.ts"], base);
    expect(await read("README.md")).toBe("# Test\n");
    expect(existsSync(join(repo.dir, "new.ts"))).toBe(false);
    expect(await read("keep.ts")).toBe("keep");
  });

  it("restores deleted files and treats paths literally", async () => {
    await repo.write("[x].ts", "1");
    const commit = await vcs.commit("chore: add");
    await rm(join(repo.dir, "[x].ts"));
    await vcs.revertPaths(["[x].ts"], commit);
    expect(await read("[x].ts")).toBe("1");
  });

  it("ignores an empty revert", async () => {
    await expect(vcs.revertPaths([], base)).resolves.toBeUndefined();
  });

  it("commits all changes, also when empty", async () => {
    await repo.write("a.ts", "a");
    const first = await vcs.commit("chore(conductor): one");
    const second = await vcs.commit("chore(conductor): empty");
    expect(repo.git("rev-parse", "HEAD")).toBe(second);
    expect(repo.git("rev-parse", "HEAD~1")).toBe(first);
    expect(repo.git("status", "--porcelain")).toBe("");
  });

  it("squashes commits and uncommitted changes into one commit", async () => {
    await repo.write("a.ts", "a");
    await vcs.commit("chore(conductor): one");
    await repo.write("b.ts", "b");
    const squashed = await vcs.squash({ since: base, message: "feat: done" });
    expect(repo.git("rev-parse", "HEAD~1")).toBe(base);
    expect(repo.git("log", "-1", "--format=%s")).toBe("feat: done");
    expect(repo.git("show", "--name-only", "--format=", squashed)).toBe(
      "a.ts\nb.ts",
    );
  });

  it("knows whether the working tree is clean", async () => {
    expect(await vcs.isClean()).toBe(true);
    await repo.write("new.ts", "x");
    expect(await vcs.isClean()).toBe(false);
  });

  it("reports an unchanged integrity snapshot", async () => {
    const before = await vcs.integritySnapshot();
    await repo.write("a.ts", "a");
    expect(await vcs.integritySnapshot()).toBe(before);
  });
});

describe("push", () => {
  async function bareRemote(): Promise<string> {
    const remote = await mkdtemp(join(tmpdir(), "conductor-remote-"));
    execFileSync("git", ["init", "-q", "--bare", remote]);
    repo.git("remote", "add", "origin", remote);
    return remote;
  }

  it("pushes and force-pushes rewritten history", async () => {
    const remote = await bareRemote();
    await vcs.createBranch("conductor/x", "main");
    await vcs.commit("chore(conductor): one");
    await vcs.push("origin");
    const squashed = await vcs.squash({ since: base, message: "feat: x" });
    await vcs.push("origin");
    const pushed = execFileSync("git", ["rev-parse", "conductor/x"], {
      cwd: remote,
      encoding: "utf8",
    });
    expect(pushed.trim()).toBe(squashed);
  });

  it("refuses to overwrite commits it has not seen", async () => {
    const remote = await bareRemote();
    await vcs.createBranch("conductor/x", "main");
    await vcs.push("origin");
    const other = await mkdtemp(join(tmpdir(), "conductor-other-"));
    const run = (...args: string[]): void => {
      execFileSync("git", args, { cwd: other });
    };
    run("clone", "-q", "-b", "conductor/x", remote, ".");
    run(
      "-c",
      "user.name=H",
      "-c",
      "user.email=h@x",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "human",
    );
    run("push", "-q", "origin", "conductor/x");
    await vcs.squash({ since: base, message: "feat: x" });
    await expect(vcs.push("origin")).rejects.toThrow(/stale info|rejected/);
  });
});
