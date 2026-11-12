import { execFile } from "node:child_process";

export interface GhCommand {
  readonly args: readonly string[];
  /** Written to stdin, e.g. for `--body-file -`. */
  readonly input?: string;
}

/** Runs one `gh` command and resolves with stdout. */
export type Gh = (command: GhCommand) => Promise<string>;

export interface GhOptions {
  /** Repository working directory; `gh` reads owner and repo from its remote. */
  readonly cwd: string;
  /** Executable, `gh` by default; tests pass a stand-in. */
  readonly binary?: string;
}

const MAX_OUTPUT = 64 * 1024 * 1024;

const HINTS: readonly (readonly [RegExp, string])[] = [
  [
    /gh auth login|not logged in|authentication/i,
    "gh is not authenticated; run `gh auth login` or set GH_TOKEN.",
  ],
  [/rate limit/i, "GitHub rate limit exceeded; try again later."],
  [/HTTP 404|Not Found|could not resolve/i, "Not found on GitHub."],
];

/** Explains a failed `gh` call; exported for tests. */
export function describeGhFailure(
  args: readonly string[],
  detail: string,
): string {
  const hint = HINTS.find(([pattern]) => pattern.test(detail))?.[1];
  const base = `gh ${args.join(" ")} failed: ${detail}`;
  return hint === undefined ? base : `${hint}\n${base}`;
}

const NOT_INSTALLED =
  "gh is not installed; install the GitHub CLI from https://cli.github.com.";

export function createGh(options: GhOptions): Gh {
  const binary = options.binary ?? "gh";
  return (command) =>
    new Promise((resolve, reject) => {
      const child = execFile(
        binary,
        [...command.args],
        { cwd: options.cwd, maxBuffer: MAX_OUTPUT },
        (error, stdout, stderr) => {
          if (error === null) {
            resolve(stdout);
            return;
          }
          if ("code" in error && error.code === "ENOENT") {
            reject(new Error(NOT_INSTALLED));
            return;
          }
          const detail = stderr.trim() === "" ? error.message : stderr.trim();
          reject(new Error(describeGhFailure(command.args, detail)));
        },
      );
      // gh may exit without reading stdin; the exit status reports failures.
      child.stdin?.on("error", () => undefined);
      child.stdin?.end(command.input ?? "");
    });
}
