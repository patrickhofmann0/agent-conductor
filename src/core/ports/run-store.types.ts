import type { RunState } from "../schemas/state.js";

/**
 * Persists run state and artifacts (requirements, plan, reviews). During a run
 * they live in the working tree under .conductor/runs/<id>/.
 */
export interface RunStore {
  saveState(state: RunState): Promise<void>;
  /** Loads and validates the state; rejects if the run does not exist. */
  loadState(runId: string): Promise<RunState>;
  writeArtifact(runId: string, name: string, content: string): Promise<void>;
  readArtifact(runId: string, name: string): Promise<string | null>;
  /**
   * Moves the run out of the working tree before the final squash. Later
   * saveState/loadState calls use the archived location.
   */
  archive(runId: string): Promise<void>;
  /** Moves an archived run back into the working tree; the reverse of archive. */
  restore(runId: string): Promise<void>;
}
