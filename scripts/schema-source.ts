import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  GENERATOR_MODULE,
  SCHEMA_FILE,
  serializeSchema,
} from "./schema-drift.js";

/**
 * Loads the config JSON schema from its generator module.
 * Returns null while the generator does not exist yet.
 */
export async function generateSchema(): Promise<string | null> {
  const modulePath = resolve(GENERATOR_MODULE);
  if (!existsSync(modulePath)) return null;
  const module: unknown = await import(pathToFileURL(modulePath).href);
  if (
    typeof module !== "object" ||
    module === null ||
    !("configJsonSchema" in module) ||
    typeof module.configJsonSchema !== "function"
  ) {
    throw new Error(
      `${GENERATOR_MODULE} must export a function configJsonSchema().`,
    );
  }
  const schema: unknown = Reflect.apply(module.configJsonSchema, undefined, []);
  return serializeSchema(schema);
}

export function readCommittedSchema(): string | null {
  return existsSync(SCHEMA_FILE) ? readFileSync(SCHEMA_FILE, "utf8") : null;
}
