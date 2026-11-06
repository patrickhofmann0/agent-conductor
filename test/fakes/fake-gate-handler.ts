import type {
  GateDecision,
  GateHandler,
  GateName,
  GateRequest,
  LimitDecision,
  LimitRequest,
} from "../../src/core/ports/gate-handler.types.js";

/** Approves every gate and stops at every limit unless decisions are scripted. */
export class FakeGateHandler implements GateHandler {
  readonly requests: GateRequest[] = [];
  readonly limitRequests: LimitRequest[] = [];
  private readonly decisions = new Map<GateName, GateDecision[]>();
  private readonly limitDecisions: LimitDecision[] = [];

  decide(gate: GateName, ...decisions: GateDecision[]): this {
    this.decisions.set(gate, [
      ...(this.decisions.get(gate) ?? []),
      ...decisions,
    ]);
    return this;
  }

  decideLimit(...decisions: LimitDecision[]): this {
    this.limitDecisions.push(...decisions);
    return this;
  }

  request(request: GateRequest): Promise<GateDecision> {
    this.requests.push(request);
    return Promise.resolve(
      this.decisions.get(request.gate)?.shift() ?? { kind: "approve" },
    );
  }

  resolveLimit(request: LimitRequest): Promise<LimitDecision> {
    this.limitRequests.push(request);
    return Promise.resolve(this.limitDecisions.shift() ?? { kind: "draft_pr" });
  }
}
