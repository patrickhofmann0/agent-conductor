import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { createFileRunStore } from "../../adapters/store/file-run-store.js";
import { archiveDirectory } from "../engine-setup.js";
import { describeError, UsageError } from "../errors.js";

import type { RunStore } from "../../core/ports/run-store.types.js";
import type { Command } from "../cli.types.js";

async function runIds(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function describeRun(store: RunStore, runId: string): Promise<string> {
  try {
    const state = await store.loadState(runId);
    const started = new Date(state.startedAt).toISOString();
    return [runId, state.status, state.step, state.branch, started].join("  ");
  } catch (error: unknown) {
    return `${runId}  unreadable: ${describeError(error)}`;
  }
}

/** `conductor runs`: lists runs that are still in the working tree. */
export const runsCommand: Command = async ({ args, io }) => {
  if (args.length > 0) throw new UsageError("runs takes no arguments.");
  const ids = await runIds(join(io.cwd, ".conductor", "runs"));
  if (ids.length === 0) {
    io.stdout("No open runs.\n");
    return 0;
  }
  const store = createFileRunStore({
    repository: io.cwd,
    archiveDirectory: archiveDirectory(io.env),
  });
  for (const id of ids) io.stdout(`${await describeRun(store, id)}\n`);
  return 0;
};
