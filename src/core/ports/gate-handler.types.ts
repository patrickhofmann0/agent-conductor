export type GateName = "po" | "planner" | "final";

export interface GateRequest {
  readonly runId: string;
  readonly gate: GateName;
  /** File name of the artifact under review, e.g. "requirements.md". */
  readonly artifactName: string;
  readonly artifact: string;
  readonly branch: string;
  /** When the gate opened (epoch ms); only feedback after it counts. */
  readonly since: number;
}

export type GateDecision =
  | { readonly kind: "approve" }
  | { readonly kind: "revise"; readonly feedback: string }
  | { readonly kind: "abort"; readonly reason: string }
  /** No decision yet (CI): the run pauses and resumes later. */
  | { readonly kind: "pending" };

export type LimitKind = "iterations" | "cost" | "time" | "phase_failed";

export interface LimitRequest {
  readonly runId: string;
  readonly kind: LimitKind;
  readonly detail: string;
}

export type LimitDecision =
  /** Grant another budget of the same size and continue. */
  | { readonly kind: "continue" }
  | { readonly kind: "draft_pr" }
  | { readonly kind: "abort"; readonly reason: string };

/** Lets a human approve intermediate results and decide what happens at limits. */
export interface GateHandler {
  request(request: GateRequest): Promise<GateDecision>;
  resolveLimit(request: LimitRequest): Promise<LimitDecision>;
}
