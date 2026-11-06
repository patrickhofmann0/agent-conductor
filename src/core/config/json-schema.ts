import { z } from "zod";

import { configSchema } from "../schemas/config.js";

export const CONFIG_SCHEMA_ID =
  "https://raw.githubusercontent.com/patrickhofmann0/agent-conductor/main/conductor.schema.json";

/** JSON schema for conductor.yaml, describing the file as users write it. */
export function configJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(configSchema, { io: "input", target: "draft-2020-12" }),
    $id: CONFIG_SCHEMA_ID,
    title: "agent-conductor configuration (conductor.yaml)",
  };
}
