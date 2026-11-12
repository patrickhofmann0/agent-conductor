import type { Readable } from "node:stream";

/** Everything the CLI needs from the process; tests pass their own. */
export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly stdin: Readable;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export interface CommandInput {
  /** Positional arguments after the command name. */
  readonly args: readonly string[];
  readonly noPr: boolean;
  /** `--issue <ref>`: the issue to implement instead of a task text. */
  readonly issue?: string | undefined;
  /** `--gates pr`: gate on pull request reviews instead of the terminal. */
  readonly forgeGates?: boolean;
  readonly io: CliIo;
}

/** Runs one subcommand and returns the exit code. */
export type Command = (input: CommandInput) => Promise<number>;
