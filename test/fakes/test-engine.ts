import { FakeAgentRunner } from "./fake-agent-runner.js";
import { FakeCheckRunner } from "./fake-check-runner.js";
import { FakeClock } from "./fake-clock.js";
import { FakeGateHandler } from "./fake-gate-handler.js";
import { FakePublisher, FakeReporter } from "./fake-output.js";
import { FakeRunStore } from "./fake-run-store.js";
import { FakeVcs } from "./fake-vcs.js";
import { createRunState } from "../../src/core/pipeline/create-state.js";
import { configSchema } from "../../src/core/schemas/config.js";

import type { EngineContext } from "../../src/core/pipeline/engine.types.js";
import type { RunState } from "../../src/core/schemas/state.js";

export interface TestEngine {
  readonly ctx: EngineContext;
  readonly agents: FakeAgentRunner;
  readonly vcs: FakeVcs;
  readonly checks: FakeCheckRunner;
  readonly gates: FakeGateHandler;
  readonly store: FakeRunStore;
  readonly publisher: FakePublisher;
  readonly clock: FakeClock;
  readonly reporter: FakeReporter;
}

export const RUN_ID = "20261106-120000-test";

/** Builds an engine context from fakes and a conductor.yaml-shaped config. */
export function createTestEngine(configInput: unknown = {}): TestEngine {
  const clock = new FakeClock();
  const fakes = {
    agents: new FakeAgentRunner(clock),
    vcs: new FakeVcs(),
    checks: new FakeCheckRunner(),
    gates: new FakeGateHandler(),
    store: new FakeRunStore(),
    publisher: new FakePublisher(),
    clock,
    reporter: new FakeReporter(),
  };
  return {
    ...fakes,
    ctx: { deps: fakes, config: configSchema.parse(configInput) },
  };
}

/** A fresh run state at the product owner step. */
export function newState(overrides: Partial<RunState> = {}): RunState {
  return {
    ...createRunState({
      runId: RUN_ID,
      input: {
        kind: "issue",
        title: "Add CSV export",
        body: "Users need CSV.",
        ref: "o/r#42",
      },
      branch: `conductor/${RUN_ID}-add-csv-export`,
      baseCommit: "base",
      startedAt: 1_000_000,
    }),
    ...overrides,
  };
}

/** A run state inside the review loop, with requirements and plan stored. */
export async function loopState(
  engine: TestEngine,
  overrides: Partial<RunState> = {},
): Promise<RunState> {
  await engine.store.writeArtifact(RUN_ID, "requirements.md", "# Requirements");
  await engine.store.writeArtifact(RUN_ID, "plan.md", "# Plan");
  return newState({ step: "coder", iteration: 1, route: "both", ...overrides });
}
