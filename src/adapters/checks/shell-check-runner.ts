import { spawn } from "node:child_process";

import type { CheckRunner } from "../../core/ports/check-runner.types.js";
import type { CheckResult } from "../../core/schemas/check-result.js";
import type { CheckConfig } from "../../core/schemas/config.js";

import { truncateOutput } from "./truncate.js";

const DEFAULT_MAX_OUTPUT_CHARS = 20_000;

export interface ShellCheckRunnerOptions {
  /** Working directory of the checks (the target repository). */
  readonly cwd: string;
  readonly maxOutputChars?: number;
}

interface Exit {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly output: string;
}

/** Plain output: no colors or interactive prompts. */
const CHECK_ENV = { CI: "true", NO_COLOR: "1", FORCE_COLOR: "0" };

function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    // A negative PID addresses the whole process group, including grandchildren.
    process.kill(-pid, "SIGKILL");
  } catch {
    // The group has already exited.
  }
}

function execute(check: CheckConfig, cwd: string): Promise<Exit> {
  return new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    const child = spawn(check.command, {
      cwd,
      shell: true,
      detached: true,
      env: { ...process.env, ...CHECK_ENV },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = (chunk: Buffer): void => {
      output += chunk.toString();
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid);
    }, check.timeout);
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        timedOut,
        output: `${output}${error.message}`,
      });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: timedOut ? null : code, timedOut, output });
    });
  });
}

/** Runs checks as shell commands in the repository. */
export function createShellCheckRunner(
  options: ShellCheckRunnerOptions,
): CheckRunner {
  const maxChars = options.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
  return {
    run: async (check): Promise<CheckResult> => {
      const started = Date.now();
      const exit = await execute(check, options.cwd);
      const note = exit.timedOut
        ? `\n[conductor] check timed out after ${String(check.timeout)} ms`
        : "";
      return {
        name: check.name,
        required: check.required,
        passed: exit.exitCode === 0,
        exitCode: exit.exitCode,
        timedOut: exit.timedOut,
        durationMs: Date.now() - started,
        output: truncateOutput(exit.output, maxChars) + note,
      };
    },
  };
}
