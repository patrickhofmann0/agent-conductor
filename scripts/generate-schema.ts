import { writeFileSync } from "node:fs";

import { GENERATOR_MODULE, SCHEMA_FILE } from "./schema-drift.js";
import { generateSchema } from "./schema-source.js";

const schema = await generateSchema();
if (schema === null) {
  console.error(`${GENERATOR_MODULE} does not exist yet.`);
  process.exit(1);
}

writeFileSync(SCHEMA_FILE, schema);
console.log(`Wrote ${SCHEMA_FILE}.`);
