import {
  RUN_STATE_VERSION,
  type RunInput,
  type RunState,
} from "../schemas/state.js";

export interface NewRun {
  readonly runId: string;
  readonly input: RunInput;
  readonly branch: string;
  readonly baseCommit: string;
  readonly startedAt: number;
}

export function createRunState(run: NewRun): RunState {
  return {
    schemaVersion: RUN_STATE_VERSION,
    runId: run.runId,
    status: "running",
    step: "po",
    iteration: 0,
    humanIterations: 0,
    route: "both",
    input: run.input,
    baseCommit: run.baseCommit,
    branch: run.branch,
    startedAt: run.startedAt,
    activeMs: 0,
    costUsd: 0,
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
}
