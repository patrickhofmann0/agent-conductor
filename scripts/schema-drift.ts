export interface SchemaDriftInput {
  /** Freshly generated schema, or null if the generator module does not exist. */
  readonly generated: string | null;
  /** Committed schema file content, or null if the file does not exist. */
  readonly committed: string | null;
}

export interface SchemaDriftResult {
  readonly ok: boolean;
  readonly message: string;
}

export const SCHEMA_FILE = "conductor.schema.json";
export const GENERATOR_MODULE = "src/core/config/json-schema.ts";

export function serializeSchema(schema: unknown): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

export function evaluateSchemaDrift(
  input: SchemaDriftInput,
): SchemaDriftResult {
  const { generated, committed } = input;
  if (generated === null && committed === null) {
    return { ok: true, message: "No config schema yet, nothing to check." };
  }
  if (generated === null) {
    return {
      ok: false,
      message: `${SCHEMA_FILE} exists but its generator ${GENERATOR_MODULE} is missing.`,
    };
  }
  if (committed === null) {
    return {
      ok: false,
      message: `${SCHEMA_FILE} is missing. Run \`bun run schema:generate\`.`,
    };
  }
  if (generated !== committed) {
    return {
      ok: false,
      message: `${SCHEMA_FILE} is out of date. Run \`bun run schema:generate\` and commit the result.`,
    };
  }
  return { ok: true, message: `${SCHEMA_FILE} is up to date.` };
}
