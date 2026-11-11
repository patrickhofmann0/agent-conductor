import { mkdtemp } from "node:fs/promises";
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

import { createReviseCommand } from "./revise.js";
import { createRunCommand } from "./run.js";

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

describe("revise command", () => {
  async function finishedRun(): Promise<string> {
    const first = io("a\na\n");
    await createRunCommand(agents().open)({
      args: ["Add CSV export"],
      noPr: true,
      io: first.io,
    });
    return /Starting run (\S+)/.exec(first.err())?.[1] ?? "";
  }

  it("reopens a finished run and keeps exactly one commit", async () => {
    const runId = await finishedRun();
    const { io: cliIo, out } = io("");

    const code = await createReviseCommand(
      agents({ coderFile: "header.ts" }).open,
    )({
      args: [runId, "Add", "a", "header"],
      noPr: true,
      io: cliIo,
    });

    expect(code).toBe(0);
    expect(out()).toContain(`${runId} done`);
    expect(repo.git("rev-list", "--count", "main..HEAD")).toBe("1");
    expect(repo.git("show", "--name-only", "--format=", "HEAD")).toBe(
      "export.ts\nheader.ts",
    );
    expect(repo.git("status", "--porcelain")).toBe("");
  });

  it("requires the run's branch to be checked out", async () => {
    const runId = await finishedRun();
    repo.git("switch", "-q", "main");

    await expect(
      createReviseCommand(agents().open)({
        args: [runId, "More"],
        noPr: true,
        io: io("").io,
      }),
    ).rejects.toThrow(/switch to it first: git switch conductor\//);
  });

  it("requires a clean working tree", async () => {
    const runId = await finishedRun();
    await repo.write("wip.ts", "x");

    await expect(
      createReviseCommand(agents().open)({
        args: [runId, "More"],
        noPr: true,
        io: io("").io,
      }),
    ).rejects.toThrow(/uncommitted changes/);
  });

  it.each([
    [[], true, "revise needs a run ID and feedback."],
    [["run-1"], true, "revise needs a run ID and feedback."],
    [["run-1", "  "], true, "revise needs a run ID and feedback."],
  ])("rejects args %j with noPr %s", async (args, noPr, message) => {
    await expect(
      createReviseCommand(agents().open)({ args, noPr, io: io("").io }),
    ).rejects.toThrow(message);
  });
});
