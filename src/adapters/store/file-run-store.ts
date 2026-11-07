import {
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import type { RunStore } from "../../core/ports/run-store.types.js";
import { runStateSchema, type RunState } from "../../core/schemas/state.js";

export interface FileRunStoreOptions {
  /** The target repository; active runs live in `.conductor/runs/<id>/`. */
  readonly repository: string;
  /** Where finished runs are moved, e.g. `~/.local/share/agent-conductor/runs`. */
  readonly archiveDirectory: string;
}

const STATE_FILE = "state.json";
const RUN_ID = /^[a-z0-9][a-z0-9-]*$/;
const ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function checked(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new Error(`Invalid ${what} "${value}"`);
  return value;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isPermissionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "EACCES" || error.code === "EPERM")
  );
}

async function move(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch {
    // Different file systems (EXDEV) or an existing target: copy, then delete.
    await cp(from, to, { recursive: true, force: true });
    await rm(from, { recursive: true, force: true });
  }
}

interface ArchiveRequest {
  readonly runId: string;
  readonly source: string;
  readonly archiveDirectory: string;
  readonly destination: string;
}

async function archiveRun(request: ArchiveRequest): Promise<void> {
  if (!(await exists(request.source))) return;
  try {
    await mkdir(request.archiveDirectory, { recursive: true });
    await move(request.source, request.destination);
  } catch (error: unknown) {
    if (!isPermissionError(error)) throw error;
    throw new Error(
      `Cannot archive run ${request.runId} to "${request.archiveDirectory}" because access was denied. Check its ownership and permissions, or set XDG_DATA_HOME to a writable directory.`,
      { cause: error },
    );
  }
}

/** Stores run state and artifacts as files (plan 7.3). */
export function createFileRunStore(options: FileRunStoreOptions): RunStore {
  const active = (runId: string): string =>
    join(
      options.repository,
      ".conductor",
      "runs",
      checked(runId, RUN_ID, "run ID"),
    );
  const archived = (runId: string): string =>
    join(options.archiveDirectory, checked(runId, RUN_ID, "run ID"));
  const directory = async (runId: string): Promise<string> =>
    (await exists(archived(runId))) ? archived(runId) : active(runId);
  const file = async (runId: string, name: string): Promise<string> =>
    join(await directory(runId), checked(name, ARTIFACT_NAME, "artifact name"));

  const write = async (
    runId: string,
    name: string,
    content: string,
  ): Promise<void> => {
    const path = await file(runId, name);
    await mkdir(await directory(runId), { recursive: true });
    await writeFile(`${path}.tmp`, content);
    await rename(`${path}.tmp`, path);
  };

  return {
    saveState: (state: RunState) =>
      write(state.runId, STATE_FILE, `${JSON.stringify(state, null, 2)}\n`),
    loadState: async (runId) => {
      let text: string;
      try {
        text = await readFile(await file(runId, STATE_FILE), "utf8");
      } catch (error: unknown) {
        if (isNotFound(error))
          throw new Error(`Unknown run ${runId}`, { cause: error });
        throw error;
      }
      return runStateSchema.parse(JSON.parse(text));
    },
    writeArtifact: write,
    readArtifact: async (runId, name) => {
      try {
        return await readFile(await file(runId, name), "utf8");
      } catch (error: unknown) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    archive: (runId) =>
      archiveRun({
        runId,
        source: active(runId),
        archiveDirectory: options.archiveDirectory,
        destination: archived(runId),
      }),
  };
}
