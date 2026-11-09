import { z } from "zod";

import { checkResultSchema } from "./check-result.js";
import { routeSchema } from "./role.js";
import { findingSchema, verdictSchema } from "./verdict.js";

export const STEPS = [
  "po",
  "po_gate",
  "planner",
  "planner_gate",
  "coder",
  "tester",
  "checks",
  "review",
  "final_gate",
  "finalize",
] as const;

const stepSchema = z.enum(STEPS);

export type Step = z.infer<typeof stepSchema>;

const runStatusSchema = z.enum([
  "running",
  "waiting_for_gate",
  "done",
  "needs_human",
  "failed",
  "aborted",
]);

export type RunStatus = z.infer<typeof runStatusSchema>;

const runInputSchema = z.strictObject({
  kind: z.enum(["prompt", "issue"]),
  title: z.string().min(1),
  body: z.string(),
  /** Issue reference such as "owner/repo#42". */
  ref: z.string().min(1).optional(),
});

export type RunInput = z.infer<typeof runInputSchema>;

const phaseRecordSchema = z.strictObject({
  step: stepSchema,
  iteration: z.int().min(0),
  sessionId: z.string().min(1),
  status: z.enum(["completed", "timeout", "error"]),
  costUsd: z.number().min(0),
  durationMs: z.number().min(0),
});

export const RUN_STATE_VERSION = 1;

export const runStateSchema = z.strictObject({
  schemaVersion: z.literal(RUN_STATE_VERSION),
  runId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  status: runStatusSchema,
  /** The next step to execute (or the step waiting for a gate). */
  step: stepSchema,
  /** Review-loop iteration, 0 before the loop starts. */
  iteration: z.int().min(0),
  /**
   * Iterations that do not count toward the limit: those started by human
   * feedback, and all iterations before a `revise`.
   */
  humanIterations: z.int().min(0).default(0),
  /** Roles that run in the current iteration. */
  route: routeSchema,
  input: runInputSchema,
  baseCommit: z.string().min(1),
  branch: z.string().min(1),
  startedAt: z.number(),
  /** Time spent working, excluding time waiting at gates. */
  activeMs: z.number().min(0),
  costUsd: z.number().min(0),
  /** Cost and active time before the last `revise`; budgets count from there. */
  costOffsetUsd: z.number().min(0).default(0),
  activeOffsetMs: z.number().min(0).default(0),
  /** Number of times a human granted another budget after a limit was hit. */
  extensions: z.int().min(0),
  /** Set when a limit was hit and the run finishes as a draft for a human. */
  needsHuman: z.boolean(),
  /** Files the tester created or changed; protected from the coder. */
  testerPaths: z.array(z.string()),
  /** Findings to address in the current iteration. */
  findings: z.array(findingSchema),
  /** Guardrail violations detected by the framework in the current iteration. */
  violations: z.array(findingSchema),
  checkResults: z.array(checkResultSchema),
  lastVerdict: verdictSchema.nullable(),
  /** Human feedback from a gate, consumed by the next run of the gated phase. */
  gateFeedback: z.string().min(1).nullable(),
  /** Why the run ended or paused. */
  outcome: z.string().min(1).nullable(),
  history: z.array(phaseRecordSchema),
});

export type RunState = z.infer<typeof runStateSchema>;
