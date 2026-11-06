import { z } from "zod";

const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const findingSchema = z.object({
  id: z.string().min(1),
  severity: severitySchema,
  target: z.enum(["coder", "tester"]),
  file: z.string().min(1).optional(),
  line: z.int().positive().optional(),
  message: z.string().min(1),
  suggestion: z.string().min(1).optional(),
  source: z.enum(["reviewer", "framework"]).default("reviewer"),
});

export type Finding = z.output<typeof findingSchema>;

/**
 * The reviewer's structured answer. Unknown keys are stripped rather than
 * rejected, because models occasionally add extra fields.
 */
export const verdictSchema = z.object({
  verdict: z.enum(["approve", "changes_requested"]),
  route: z.enum(["coder", "tester", "both"]).default("both"),
  summary: z.string().min(1),
  findings: z.array(findingSchema).default([]),
});

export type Verdict = z.output<typeof verdictSchema>;
