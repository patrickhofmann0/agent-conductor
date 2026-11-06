import type { CheckRunner } from "../../src/core/ports/check-runner.types.js";
import type { CheckResult } from "../../src/core/schemas/check-result.js";
import type { CheckConfig } from "../../src/core/schemas/config.js";

export type ScriptedCheck = Partial<
  Pick<CheckResult, "passed" | "output" | "timedOut">
>;

/** Passes every check unless results are scripted for it. */
export class FakeCheckRunner implements CheckRunner {
  readonly runs: string[] = [];
  private readonly scripts = new Map<string, ScriptedCheck[]>();

  script(name: string, ...results: ScriptedCheck[]): this {
    this.scripts.set(name, [...(this.scripts.get(name) ?? []), ...results]);
    return this;
  }

  run(check: CheckConfig): Promise<CheckResult> {
    this.runs.push(check.name);
    const scripted = this.scripts.get(check.name)?.shift() ?? {};
    const passed = scripted.passed ?? true;
    const timedOut = scripted.timedOut ?? false;
    return Promise.resolve({
      name: check.name,
      required: check.required,
      passed,
      exitCode: timedOut ? null : passed ? 0 : 1,
      timedOut,
      durationMs: 100,
      output: scripted.output ?? (passed ? "ok" : "1 test failed"),
    });
  }
}
