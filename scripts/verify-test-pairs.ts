import { readdirSync } from "node:fs";

import { findSourcesWithoutTests } from "./test-pairs.js";

const files = readdirSync("src", { recursive: true, encoding: "utf8" }).map(
  (file) => `src/${file}`,
);
const missing = findSourcesWithoutTests(files);

if (missing.length > 0) {
  console.error(
    "Every source file needs a sibling *.test.ts. Missing tests for:",
  );
  for (const file of missing) console.error(`  - ${file}`);
  process.exit(1);
}

console.log(
  `test-pairs: ${String(files.length)} files checked, all sources have tests.`,
);
