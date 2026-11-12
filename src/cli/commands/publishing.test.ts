import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { FakeForge } from "../../../test/fakes/fake-forge.js";
import { repositoryIo, scriptedAgents } from "../../../test/support/cli-run.js";
import {
  createTempRepo,
  type TempRepo,
} from "../../../test/support/temp-repo.js";

import { issueInput, openPublishing } from "./publishing.js";
import { createReviseCommand } from "./revise.js";
import { createResumeCommand, createRunCommand } from "./run.js";

let repo: TempRepo;
let dataHome: string;
let forge: FakeForge;

beforeEach(async () => {
  repo = await createTempRepo();
  dataHome = await mkdtemp(join(tmpdir(), "conductor-data-"));
  const remote = await mkdtemp(join(tmpdir(), "conductor-remote-"));
  execFileSync("git", ["init", "-q", "--bare", remote]);
  repo.git("remote", "add", "origin", remote);
  forge = new FakeForge();
  forge.issues.set("#42", {
    ref: "#42",
    title: "Add CSV export",
    body: "Users need CSV.",
    url: "https://forge.test/issues/42",
  });
});

const openForge = (): Promise<FakeForge> => Promise.resolve(forge);

function io(answers = ""): ReturnType<typeof repositoryIo> {
  return repositoryIo(repo.dir, dataHome, answers);
}

describe("issueInput", () => {
  it("uses the title when the body is empty", () => {
    expect(
      issueInput({ ref: "o/r#1", title: " T ", body: " ", url: "u" }),
    ).toEqual({ kind: "issue", title: "T", body: "T", ref: "o/r#1" });
  });
});

describe("openPublishing", () => {
  it("does not connect with --no-pr", async () => {
    const publishing = await openPublishing(
      { args: [], noPr: true, io: io().io },
      () => Promise.reject(new Error("must not connect")),
    );
    expect(publishing).toEqual({
      forge: null,
      forgeGates: false,
      flags: "--no-pr ",
    });
  });
});

describe("runs with a pull request", () => {
  it("implements an issue and leaves a ready pull request", async () => {
    const run = createRunCommand(scriptedAgents(repo.dir).open, openForge);

    const code = await run({
      args: [],
      noPr: false,
      issue: "#42",
      io: io("a\na\n").io,
    });

    expect(code).toBe(0);
    expect(forge.pullRequests).toEqual([
      expect.objectContaining({ base: "main", draft: false }),
    ]);
    expect(forge.pullRequests[0]?.body).toMatch(/\n\nCloses #42$/);
    const branch = forge.pullRequests[0]?.branch ?? "";
    expect(repo.git("ls-remote", "origin", branch)).toContain(
      repo.git("rev-parse", "HEAD"),
    );
  });

  it("reads the issue also with --no-pr", async () => {
    const run = createRunCommand(scriptedAgents(repo.dir).open, openForge);
    const { io: cliIo, out } = io("a\na\n");

    await run({ args: [], noPr: true, issue: "#42", io: cliIo });

    expect(out()).toContain("-add-csv-export");
    expect(forge.pullRequests).toEqual([]);
  });

  it("pauses at gates until the pull request is reviewed", async () => {
    const agents = scriptedAgents(repo.dir).open;
    const first = io();
    await createRunCommand(
      agents,
      openForge,
    )({
      args: ["Add CSV export"],
      noPr: false,
      forgeGates: true,
      io: first.io,
    });
    const runId = /Starting run (\S+)/.exec(first.err())?.[1] ?? "";
    expect(first.out()).toContain(`${runId} waiting_for_gate`);
    expect(first.err()).toContain(
      `Continue with: conductor resume --gates pr ${runId}`,
    );
    expect(forge.pullRequests[0]?.draft).toBe(true);

    const pr = forge.pullRequests[0];
    if (pr === undefined) throw new Error("missing PR");
    await forge.addLabels(pr, ["conductor:approved"]);
    const resume = createResumeCommand(agents, openForge);
    const second = io();
    await resume({
      args: [runId],
      noPr: false,
      forgeGates: true,
      io: second.io,
    });
    expect(second.out()).toContain(`${runId} waiting_for_gate`);
    expect(forge.pullRequests[0]?.labels).toEqual([]);

    forge.reviews.push({
      author: "alice",
      authorCanApprove: true,
      state: "approve",
      body: "",
      submittedAt: Date.now() + 1000,
    });
    const third = io();
    await resume({
      args: [runId],
      noPr: false,
      forgeGates: true,
      io: third.io,
    });
    expect(third.out()).toContain(`${runId} done`);
    expect(forge.pullRequests[0]?.draft).toBe(false);
  });

  it("publishes a revised run again", async () => {
    const agents = scriptedAgents(repo.dir).open;
    const first = io("a\na\n");
    await createRunCommand(
      agents,
      openForge,
    )({
      args: ["Add CSV export"],
      noPr: false,
      io: first.io,
    });
    const runId = /Starting run (\S+)/.exec(first.err())?.[1] ?? "";

    const code = await createReviseCommand(
      scriptedAgents(repo.dir, { coderFile: "header.ts" }).open,
      openForge,
    )({ args: [runId, "Add a header"], noPr: false, io: io().io });

    expect(code).toBe(0);
    expect(forge.pullRequests).toHaveLength(1);
    const branch = forge.pullRequests[0]?.branch ?? "";
    expect(repo.git("ls-remote", "origin", branch)).toContain(
      repo.git("rev-parse", "HEAD"),
    );
  });
});
