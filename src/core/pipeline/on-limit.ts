import type { EngineContext } from "./engine.types.js";
import type { LimitBreach } from "./limits.js";
import type { LimitDecision } from "../ports/gate-handler.types.js";
import type { RunState } from "../schemas/state.js";

export interface LimitSituation {
  readonly state: RunState;
  readonly breach: LimitBreach;
  /** The state to continue with if a human grants more budget; defaults to `state`. */
  readonly continueWith?: RunState;
}

type Resolution = LimitDecision | { readonly kind: "fail" };

async function resolve(
  ctx: EngineContext,
  situation: LimitSituation,
): Promise<Resolution> {
  switch (ctx.config.loop.onLimit) {
    case "fail":
      return { kind: "fail" };
    case "draft_pr":
      return { kind: "draft_pr" };
    case "ask":
      return ctx.deps.gates.resolveLimit({
        runId: situation.state.runId,
        ...situation.breach,
      });
  }
}

/** Applies the configured `onLimit` behavior (ADR 0004). */
export async function handleLimit(
  ctx: EngineContext,
  situation: LimitSituation,
): Promise<RunState> {
  const { state, breach } = situation;
  ctx.deps.reporter.report({ type: "limit_reached", ...breach });
  const resolution = await resolve(ctx, situation);
  switch (resolution.kind) {
    case "continue": {
      const next = situation.continueWith ?? state;
      return { ...next, extensions: next.extensions + 1 };
    }
    case "draft_pr":
      return {
        ...state,
        step: "finalize",
        needsHuman: true,
        outcome: breach.detail,
      };
    case "fail":
      return { ...state, status: "failed", outcome: breach.detail };
    case "abort":
      return { ...state, status: "aborted", outcome: resolution.reason };
  }
}
