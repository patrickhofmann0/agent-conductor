import { z } from "zod";

export const checkResultSchema = z.strictObject({
  name: z.string().min(1),
  required: z.boolean(),
  passed: z.boolean(),
  /** Null when the process was killed (timeout) or could not start. */
  exitCode: z.int().nullable(),
  timedOut: z.boolean(),
  durationMs: z.number().min(0),
  /** Combined stdout/stderr, truncated by the check runner. */
  output: z.string(),
});

export type CheckResult = z.infer<typeof checkResultSchema>;
