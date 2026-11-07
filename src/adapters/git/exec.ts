import { execFile } from "node:child_process";

export interface GitCommand {
  /** Repository working directory. */
  readonly cwd: string;
  readonly args: readonly string[];
  /** Extra environment variables, for example `GIT_INDEX_FILE`. */
  readonly env?: Readonly<Record<string, string>>;
}

const MAX_OUTPUT = 64 * 1024 * 1024;

/** Runs git and resolves with stdout; rejects with stderr on a non-zero exit. */
export function git(command: GitCommand): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...command.args],
      {
        cwd: command.cwd,
        env: { ...process.env, ...command.env },
        maxBuffer: MAX_OUTPUT,
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve(stdout);
          return;
        }
        const detail = stderr.trim() === "" ? error.message : stderr.trim();
        reject(new Error(`git ${command.args.join(" ")} failed: ${detail}`));
      },
    );
  });
}

/** Splits NUL-separated git output (`-z`) into entries. */
export function splitNul(output: string): string[] {
  return output.split("\0").filter((entry) => entry !== "");
}
