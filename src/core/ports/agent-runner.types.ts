import type { EffectivePermissions } from "../schemas/permissions.js";
import type { Role } from "../schemas/role.js";

export interface AgentRunRequest {
  readonly role: Role;
  /** Role instructions (system prompt). */
  readonly system: string;
  /** The task for this run. */
  readonly prompt: string;
  /** "provider/model"; the harness default is used when absent. */
  readonly model?: string;
  readonly permissions: EffectivePermissions;
  readonly timeoutMs: number;
  /** Continue an existing session instead of starting a new one. */
  readonly sessionId?: string;
}

export type AgentRunStatus = "completed" | "timeout" | "error";

export interface AgentRunResult {
  readonly sessionId: string;
  readonly status: AgentRunStatus;
  /** The agent's final text answer. */
  readonly output: string;
  readonly costUsd: number;
  readonly durationMs: number;
  readonly error?: string;
}

/** Runs one agent session in the coding harness (OpenCode). */
export interface AgentRunner {
  run(request: AgentRunRequest): Promise<AgentRunResult>;
}
