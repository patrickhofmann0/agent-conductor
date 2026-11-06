import type { CheckResult } from "../schemas/check-result.js";
import type { CheckConfig } from "../schemas/config.js";

/** Runs a configured check command (tests, lint, build) in the workspace. */
export interface CheckRunner {
  run(check: CheckConfig): Promise<CheckResult>;
}
