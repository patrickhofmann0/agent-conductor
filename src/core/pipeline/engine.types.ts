import type { AgentRunner } from "../ports/agent-runner.types.js";
import type { CheckRunner } from "../ports/check-runner.types.js";
import type { Clock } from "../ports/clock.types.js";
import type { GateHandler } from "../ports/gate-handler.types.js";
import type { Publisher } from "../ports/publisher.types.js";
import type { Reporter } from "../ports/reporter.types.js";
import type { RunStore } from "../ports/run-store.types.js";
import type { Vcs } from "../ports/vcs.types.js";
import type { Config } from "../schemas/config.js";
import type { RunState } from "../schemas/state.js";

interface EngineDeps {
  readonly agents: AgentRunner;
  readonly vcs: Vcs;
  readonly checks: CheckRunner;
  readonly gates: GateHandler;
  readonly store: RunStore;
  readonly publisher: Publisher;
  readonly clock: Clock;
  readonly reporter: Reporter;
}

export interface EngineContext {
  readonly deps: EngineDeps;
  readonly config: Config;
}

/** Executes one pipeline step and returns the next state. */
export type StepHandler = (
  ctx: EngineContext,
  state: RunState,
) => Promise<RunState>;
