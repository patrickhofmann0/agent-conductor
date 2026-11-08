import { z } from "zod";

import { durationSchema } from "./duration.js";
import { permissionRuleSchema } from "./permissions.js";
import { roleSchema } from "./role.js";

const modelIdSchema = z
  .string()
  .regex(
    /^[^/\s#]+\/[^\s#]+(#[^\s#]+)?$/,
    'Use "provider/model" or "provider/model#variant", for example "openai/gpt-5#high".',
  );

const modelsSchema = z.strictObject({
  default: modelIdSchema.optional(),
  po: modelIdSchema.optional(),
  planner: modelIdSchema.optional(),
  coder: modelIdSchema.optional(),
  tester: modelIdSchema.optional(),
  reviewer: modelIdSchema.optional(),
});

const checkSchema = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes."),
  command: z.string().min(1),
  required: z.boolean().default(true),
  timeout: durationSchema.prefault("10m"),
});

export type CheckConfig = z.output<typeof checkSchema>;

const checksSchema = z.array(checkSchema).superRefine((checks, ctx) => {
  const seen = new Set<string>();
  for (const [index, check] of checks.entries()) {
    if (seen.has(check.name)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "name"],
        message: `Duplicate check name "${check.name}".`,
      });
    }
    seen.add(check.name);
  }
});

const roleConfigSchema = z.strictObject({
  prompt: z.string().min(1).optional(),
  promptMode: z.enum(["append", "replace"]).default("append"),
  /** Appended to the role's default rules; the framework's hard rules always come last. */
  permissions: z.array(permissionRuleSchema).default([]),
});

const onLimitSchema = z.enum(["draft_pr", "fail", "ask"]);

export const configSchema = z.strictObject({
  $schema: z.string().optional(),
  version: z.literal(1).default(1),
  language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Use a language code like "en" or "de".')
    .default("en"),
  models: modelsSchema.prefault({}),
  gates: z
    .strictObject({
      po: z.boolean().default(true),
      planner: z.boolean().default(true),
      final: z.boolean().default(false),
    })
    .prefault({}),
  loop: z
    .strictObject({
      maxIterations: z.int().min(1).max(20).default(3),
      onLimit: onLimitSchema.default("draft_pr"),
    })
    .prefault({}),
  limits: z
    .strictObject({
      phaseTimeout: durationSchema.prefault("20m"),
      totalTimeout: durationSchema.prefault("2h"),
      maxCostUsd: z.number().positive().default(10),
    })
    .prefault({}),
  checks: checksSchema.default([]),
  guardrails: z
    .strictObject({ paths: z.array(z.string().min(1)).default([]) })
    .prefault({}),
  git: z
    .strictObject({
      baseBranch: z.string().min(1).default("main"),
      branchPrefix: z.string().default("conductor/"),
      commitMessage: z.string().min(1).default("feat: {{title}}"),
    })
    .prefault({}),
  github: z
    .strictObject({
      labels: z
        .strictObject({
          trigger: z.string().min(1).default("conductor"),
          approved: z.string().min(1).default("conductor:approved"),
          needsHuman: z.string().min(1).default("conductor:needs-human"),
        })
        .prefault({}),
    })
    .prefault({}),
  roles: z.partialRecord(roleSchema, roleConfigSchema).prefault({}),
});

export type Config = z.output<typeof configSchema>;
