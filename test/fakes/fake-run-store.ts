import type { RunStore } from "../../src/core/ports/run-store.types.js";
import type { RunState } from "../../src/core/schemas/state.js";

/** Keeps run state and artifacts in memory. Saved states are deep copies. */
export class FakeRunStore implements RunStore {
  readonly saved: RunState[] = [];
  readonly archived = new Set<string>();
  private readonly states = new Map<string, RunState>();
  private readonly artifacts = new Map<string, string>();

  saveState(state: RunState): Promise<void> {
    const copy = structuredClone(state);
    this.states.set(state.runId, copy);
    this.saved.push(copy);
    return Promise.resolve();
  }

  loadState(runId: string): Promise<RunState> {
    const state = this.states.get(runId);
    if (state === undefined)
      return Promise.reject(new Error(`Unknown run ${runId}`));
    return Promise.resolve(structuredClone(state));
  }

  writeArtifact(runId: string, name: string, content: string): Promise<void> {
    this.artifacts.set(`${runId}/${name}`, content);
    return Promise.resolve();
  }

  readArtifact(runId: string, name: string): Promise<string | null> {
    return Promise.resolve(this.artifacts.get(`${runId}/${name}`) ?? null);
  }

  artifact(runId: string, name: string): string | undefined {
    return this.artifacts.get(`${runId}/${name}`);
  }

  archive(runId: string): Promise<void> {
    this.archived.add(runId);
    return Promise.resolve();
  }
}
