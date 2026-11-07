import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { captureIo } from "../../../test/support/cli-io.js";
import { createFileRunStore } from "../../adapters/store/file-run-store.js";
import { createRunState } from "../../core/pipeline/create-state.js";

import { showCommand } from "./show.js";

import type { RunStore } from "../../core/ports/run-store.types.js";

const RUN_ID = "20261107-a";
const APPROVE = JSON.stringify({
  verdict: "approve",
  route: "both",
  summary: "Looks good.",
  findings: [],
});

let cwd: string;
let dataHome: string;
let store: RunStore;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "conductor-show-"));
  dataHome = await mkdtemp(join(tmpdir(), "conductor-show-data-"));
  store = createFileRunStore({
    repository: cwd,
    archiveDirectory: join(dataHome, "agent-conductor", "runs"),
  });
  await store.saveState({
    ...createRunState({
      runId: RUN_ID,
      input: { kind: "prompt", title: "Task", body: "Task" },
      branch: `conductor/${RUN_ID}-task`,
      baseCommit: "abc",
      startedAt: 0,
    }),
    iteration: 3,
  });
  await store.writeArtifact(RUN_ID, "requirements.md", "# Requirements\n");
  await store.writeArtifact(RUN_ID, "plan.md", "# Plan\n");
  await store.writeArtifact(RUN_ID, "review-1.json", APPROVE);
  await store.writeArtifact(RUN_ID, "review-2.json", APPROVE);
});

function io(): ReturnType<typeof captureIo> {
  const captured = captureIo(cwd);
  return {
    ...captured,
    io: { ...captured.io, env: { XDG_DATA_HOME: dataHome } },
  };
}

describe("showCommand", () => {
  it("prints an open run with its documents and reviews", async () => {
    const { io: cliIo, out } = io();
    expect(await showCommand({ args: [RUN_ID], noPr: false, io: cliIo })).toBe(
      0,
    );
    expect(out()).toContain(`Run ${RUN_ID}: running`);
    expect(out()).toContain("## Requirements\n\n# Requirements");
    expect(out()).toContain("## Review 2\n\nVerdict: approve");
    expect(out()).not.toContain("## Review 3");
  });

  it("prints an archived run", async () => {
    await store.archive(RUN_ID);
    const { io: cliIo, out } = io();
    await showCommand({ args: [RUN_ID], noPr: false, io: cliIo });
    expect(out()).toContain("## Plan\n\n# Plan");
  });

  it("fails for an unknown run", async () => {
    await expect(
      showCommand({ args: ["missing"], noPr: false, io: io().io }),
    ).rejects.toThrow("Unknown run missing");
  });

  it.each([[[]], [["a", "b"]]])("rejects arguments %j", async (args) => {
    await expect(
      showCommand({ args, noPr: false, io: io().io }),
    ).rejects.toThrow("show needs exactly one run ID.");
  });
});
