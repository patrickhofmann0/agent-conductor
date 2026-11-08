import { existsSync } from "node:fs";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { RunStore } from "../../core/ports/run-store.types.js";
import type { RunState } from "../../core/schemas/state.js";

import { createFileRunStore } from "./file-run-store.js";

const STATE: RunState = {
  schemaVersion: 1,
  runId: "20261107-ab12",
  status: "waiting_for_gate",
  step: "po_gate",
  iteration: 0,
  humanIterations: 0,
  route: "both",
  input: { kind: "prompt", title: "CSV export", body: "Add CSV export." },
  baseCommit: "abc123",
  branch: "conductor/20261107-ab12-csv-export",
  startedAt: 0,
  activeMs: 1000,
  costUsd: 0.3,
  extensions: 0,
  needsHuman: false,
  testerPaths: [],
  findings: [],
  violations: [],
  checkResults: [],
  lastVerdict: null,
  gateFeedback: null,
  outcome: null,
  history: [],
};

let repository: string;
let archiveDirectory: string;
let store: RunStore;

beforeEach(async () => {
  repository = await mkdtemp(join(tmpdir(), "conductor-store-repo-"));
  archiveDirectory = join(
    await mkdtemp(join(tmpdir(), "conductor-store-archive-")),
    "runs",
  );
  store = createFileRunStore({ repository, archiveDirectory });
});

const activeDir = (): string =>
  join(repository, ".conductor", "runs", STATE.runId);

describe("createFileRunStore", () => {
  it("saves readable state and loads it again", async () => {
    await store.saveState(STATE);
    const text = await readFile(join(activeDir(), "state.json"), "utf8");
    expect(text).toBe(`${JSON.stringify(STATE, null, 2)}\n`);
    expect(await store.loadState(STATE.runId)).toEqual(STATE);
  });

  it("rejects an unknown run", async () => {
    await expect(store.loadState("missing")).rejects.toThrow(
      "Unknown run missing",
    );
  });

  it("rejects invalid state", async () => {
    await store.saveState(STATE);
    await writeFile(join(activeDir(), "state.json"), '{"schemaVersion":2}');
    await expect(store.loadState(STATE.runId)).rejects.toThrow();
  });

  it("writes and reads artifacts, null when missing", async () => {
    await store.writeArtifact(STATE.runId, "plan.md", "# Plan\n");
    expect(await store.readArtifact(STATE.runId, "plan.md")).toBe("# Plan\n");
    expect(await store.readArtifact(STATE.runId, "review-1.json")).toBeNull();
  });

  it.each([
    ["run ID", () => store.loadState("../etc")],
    ["artifact name", () => store.readArtifact("run-1", "../state.json")],
    ["artifact name", () => store.writeArtifact("run-1", ".hidden", "")],
  ])("rejects an invalid %s", async (what, call) => {
    await expect(call()).rejects.toThrow(`Invalid ${what}`);
  });

  it("moves the run to the archive and keeps using it there", async () => {
    await store.saveState(STATE);
    await store.writeArtifact(STATE.runId, "plan.md", "# Plan\n");
    await store.archive(STATE.runId);
    await expect(readFile(join(activeDir(), "state.json"))).rejects.toThrow();
    expect(await store.readArtifact(STATE.runId, "plan.md")).toBe("# Plan\n");
    await store.saveState({ ...STATE, status: "done" });
    const archived = join(archiveDirectory, STATE.runId, "state.json");
    expect(JSON.parse(await readFile(archived, "utf8"))).toMatchObject({
      status: "done",
    });
    expect((await store.loadState(STATE.runId)).status).toBe("done");
  });

  it("removes the emptied .conductor directories after archiving", async () => {
    await store.saveState(STATE);
    await store.archive(STATE.runId);
    expect(existsSync(join(repository, ".conductor"))).toBe(false);
  });

  it("keeps .conductor while other runs are still open", async () => {
    await store.saveState(STATE);
    await store.saveState({ ...STATE, runId: "other-run" });
    await store.archive(STATE.runId);
    expect(
      existsSync(join(repository, ".conductor", "runs", "other-run")),
    ).toBe(true);
  });

  it("archives a run only once and ignores unknown runs", async () => {
    await store.saveState(STATE);
    await store.archive(STATE.runId);
    await store.archive(STATE.runId);
    await store.archive("never-started");
    expect((await store.loadState(STATE.runId)).runId).toBe(STATE.runId);
  });

  it("explains how to fix an unwritable archive directory", async () => {
    await store.saveState(STATE);
    const parent = await mkdtemp(join(tmpdir(), "conductor-readonly-"));
    const blockedArchive = join(parent, "runs");
    await chmod(parent, 0o555);
    const blockedStore = createFileRunStore({
      repository,
      archiveDirectory: blockedArchive,
    });
    try {
      await expect(blockedStore.archive(STATE.runId)).rejects.toThrow(
        new RegExp(
          `Cannot archive run 20261107-ab12 to ".*runs" because access was denied.*XDG_DATA_HOME`,
        ),
      );
    } finally {
      await chmod(parent, 0o755);
    }
    expect(await readFile(join(activeDir(), "state.json"), "utf8")).toContain(
      STATE.runId,
    );
  });
});
