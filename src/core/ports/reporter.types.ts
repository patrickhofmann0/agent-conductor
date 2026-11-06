import type { LimitKind } from "./gate-handler.types.js";
import type { RunStatus, Step } from "../schemas/state.js";

export type RunEvent =
  | {
      readonly type: "step_started";
      readonly step: Step;
      readonly iteration: number;
    }
  | {
      readonly type: "agent_finished";
      readonly step: Step;
      readonly iteration: number;
      readonly costUsd: number;
      readonly durationMs: number;
    }
  | { readonly type: "guardrail_reverted"; readonly paths: readonly string[] }
  | {
      readonly type: "limit_reached";
      readonly kind: LimitKind;
      readonly detail: string;
    }
  | { readonly type: "run_paused"; readonly reason: string }
  | {
      readonly type: "run_finished";
      readonly status: RunStatus;
      readonly reason?: string;
    };

/** Progress output for humans (terminal, CI log). */
export interface Reporter {
  report(event: RunEvent): void;
}
