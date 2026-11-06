import { evaluateSchemaDrift } from "./schema-drift.js";
import { generateSchema, readCommittedSchema } from "./schema-source.js";

const result = evaluateSchemaDrift({
  generated: await generateSchema(),
  committed: readCommittedSchema(),
});

console.log(`schema-drift: ${result.message}`);
process.exit(result.ok ? 0 : 1);
