import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  repositoryIo,
  scriptedAgents,
  type ScriptedAgentOptions,
  type ScriptedAgents,
} from "../../../test/support/cli-run.js";
import {
  createTempRepo,
  type TempRepo,
} from "../../../test/support/temp-repo.js";

import { createResumeCommand, createRunCommand, promptInput } from "./run.js";

let repo: TempRepo;
let dataHome: string;

beforeEach(async () => {
  repo = await createTempRepo();
  dataHome = await mkdtemp(join(tmpdir(), "conductor-data-"));
});

function agents(options: ScriptedAgentOptions = {}): ScriptedAgents {
  return scriptedAgents(repo.dir, options);
}

function io(answers: string): ReturnType<typeof repositoryIo> {
  return repositoryIo(repo.dir, dataHome, answers);
}

describe("run command", () => {
  it("runs all phases into a branch with exactly one commit", async () => {
    const fake = agents();
    const { io: cliIo, out, err } = io("a\na\n");
    const code = await createRunCommand(fake.open)({
      args: ["Add", "CSV", "export"],
      noPr: true,
      io: cliIo,
    });
    expect(code).toBe(0);
    expect(out()).toMatch(/^\S+ done conductor\/\S+-add-csv-export\n$/);
    expect(err()).toContain("po gate: requirements.md");
    expect(err()).not.toContain("reverted");
    expect(err()).toContain("!!! No checks are configured in conductor.yaml.");
    expect(err()).not.toContain("warning: No checks configured");
    expect(repo.git("rev-list", "--count", "main..HEAD")).toBe("1");
    expect(repo.git("show", "--name-only", "--format=", "HEAD")).toBe(
      "export.ts",
    );
    expect(repo.git("status", "--porcelain")).toBe("");
    expect(
      await readdir(join(dataHome, "agent-conductor", "runs")),
    ).toHaveLength(1);
    expect(fake.closed()).toBe(true);
  });

  it("does not warn when checks are configured", async () => {
    await repo.write(
      "conductor.yaml",
      'checks:\n  - name: test\n    command: "true"\n',
    );
    repo.git("add", "-A");
    repo.git("commit", "-q", "-m", "chore: add checks");
    const { io: cliIo, out, err } = io("a\na\n");
    const code = await createRunCommand(agents().open)({
      args: ["Add CSV export"],
      noPr: true,
      io: cliIo,
    });
    expect(code).toBe(0);
    expect(out()).toContain(" done ");
    expect(err()).not.toContain("!!!");
    expect(err()).toContain("> checks (iteration 1)");
  });

  it("can be resumed after an interruption", async () => {
    const first = io("a\n");
    await expect(
      createRunCommand(agents({ failAt: "planner" }).open)({
        args: ["Add CSV export"],
        noPr: true,
        io: first.io,
      }),
    ).rejects.toThrow("Interrupted");
    const runId = /Starting run (\S+)/.exec(first.err())?.[1] ?? "";

    const second = io("a\n");
    const code = await createResumeCommand(agents().open)({
      args: [runId],
      noPr: true,
      io: second.io,
    });
    expect(code).toBe(0);
    expect(second.out()).toContain(`${runId} done`);
    expect(repo.git("rev-list", "--count", "main..HEAD")).toBe("1");
  });

  it("exits with 1 when the human aborts", async () => {
    const { io: cliIo, out } = io("x\nWrong task\n");
    const code = await createRunCommand(agents().open)({
      args: ["Add CSV export"],
      noPr: true,
      io: cliIo,
    });
    expect(code).toBe(1);
    expect(out()).toContain(" aborted ");
  });

  it("refuses to start on a dirty working tree", async () => {
    await repo.write("wip.ts", "x");
    const fake = agents();
    await expect(
      createRunCommand(fake.open)({
        args: ["Task"],
        noPr: true,
        io: io("").io,
      }),
    ).rejects.toThrow(/uncommitted changes/);
    expect(fake.closed()).toBe(true);
  });

  it.each([
    [[], true, "run needs a task description."],
    [["Task"], false, "pass --no-pr"],
  ])("rejects args %j with noPr %s", async (args, noPr, message) => {
    await expect(
      createRunCommand(agents().open)({ args, noPr, io: io("").io }),
    ).rejects.toThrow(message);
  });
});

describe("resume command", () => {
  it.each([
    [[], true, "resume needs exactly one run ID."],
    [["a", "b"], true, "resume needs exactly one run ID."],
    [["a"], false, "pass --no-pr"],
  ])("rejects args %j with noPr %s", async (args, noPr, message) => {
    await expect(
      createResumeCommand(agents().open)({ args, noPr, io: io("").io }),
    ).rejects.toThrow(message);
  });

  it("fails for an unknown run", async () => {
    await expect(
      createResumeCommand(agents().open)({
        args: ["missing"],
        noPr: true,
        io: io("").io,
      }),
    ).rejects.toThrow("Unknown run missing");
  });
});

describe("promptInput", () => {
  it("uses the first line as title and the whole text as body", () => {
    expect(promptInput("  Add CSV\n\nDetails  ")).toEqual({
      kind: "prompt",
      title: "Add CSV",
      body: "Add CSV\n\nDetails",
    });
  });

  it("shortens long titles", () => {
    const title = promptInput("x".repeat(100)).title;
    expect(title).toHaveLength(72);
    expect(title.endsWith("…")).toBe(true);
  });
});
