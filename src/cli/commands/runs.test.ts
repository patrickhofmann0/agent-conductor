import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { captureIo } from "../../../test/support/cli-io.js";
import { createFileRunStore } from "../../adapters/store/file-run-store.js";
import { createRunState } from "../../core/pipeline/create-state.js";

import { runsCommand } from "./runs.js";

let cwd: string;
let dataHome: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "conductor-runs-"));
  dataHome = await mkdtemp(join(tmpdir(), "conductor-runs-data-"));
});

function io(): ReturnType<typeof captureIo> {
  const captured = captureIo(cwd);
  return {
    ...captured,
    io: { ...captured.io, env: { XDG_DATA_HOME: dataHome } },
  };
}

async function saveRun(runId: string, startedAt: number): Promise<void> {
  const store = createFileRunStore({
    repository: cwd,
    archiveDirectory: join(dataHome, "agent-conductor", "runs"),
  });
  await store.saveState({
    ...createRunState({
      runId,
      input: { kind: "prompt", title: "Task", body: "Task" },
      branch: `conductor/${runId}-task`,
      baseCommit: "abc",
      startedAt,
    }),
    status: "waiting_for_gate",
    step: "po_gate",
  });
}

describe("runsCommand", () => {
  it("reports when there are no runs", async () => {
    const { io: cliIo, out } = io();
    expect(await runsCommand({ args: [], noPr: false, io: cliIo })).toBe(0);
    expect(out()).toBe("No open runs.\n");
  });

  it("lists runs sorted by ID with status, step, branch and start", async () => {
    await saveRun("20261107-b", Date.UTC(2026, 10, 7, 12));
    await saveRun("20261107-a", Date.UTC(2026, 10, 7, 11));
    const { io: cliIo, out } = io();
    expect(await runsCommand({ args: [], noPr: false, io: cliIo })).toBe(0);
    expect(out()).toBe(
      [
        "20261107-a  waiting_for_gate  po_gate  conductor/20261107-a-task  2026-11-07T11:00:00.000Z",
        "20261107-b  waiting_for_gate  po_gate  conductor/20261107-b-task  2026-11-07T12:00:00.000Z",
        "",
      ].join("\n"),
    );
  });

  it("shows unreadable runs instead of failing", async () => {
    await mkdir(join(cwd, ".conductor", "runs", "broken"), { recursive: true });
    await writeFile(join(cwd, ".conductor", "runs", "stray.txt"), "");
    const { io: cliIo, out } = io();
    expect(await runsCommand({ args: [], noPr: false, io: cliIo })).toBe(0);
    expect(out()).toBe("broken  unreadable: Unknown run broken\n");
  });

  it("rethrows unexpected read errors", async () => {
    await mkdir(join(cwd, ".conductor"), { recursive: true });
    await writeFile(join(cwd, ".conductor", "runs"), "not a directory");
    await expect(
      runsCommand({ args: [], noPr: false, io: io().io }),
    ).rejects.toThrow(/ENOTDIR/);
  });

  it("rejects arguments", async () => {
    await expect(
      runsCommand({ args: ["x"], noPr: false, io: io().io }),
    ).rejects.toThrow("runs takes no arguments.");
  });
});
