import type { z } from "zod";

import { configSchema, type Config } from "../schemas/config.js";

export type ParseConfigResult =
  | { readonly ok: true; readonly config: Config }
  | { readonly ok: false; readonly errors: readonly string[] };

function formatIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.map(String).join(".");
  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

/**
 * Validates raw configuration (for example parsed YAML) and applies defaults.
 * `null` and `undefined` (an empty or missing file) yield the default config.
 */
export function parseConfig(raw: unknown): ParseConfigResult {
  const result = configSchema.safeParse(raw ?? {});
  if (result.success) return { ok: true, config: result.data };
  return { ok: false, errors: result.error.issues.map(formatIssue) };
}
