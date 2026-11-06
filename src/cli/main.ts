import { parseArgs } from "node:util";

import pkg from "../../package.json" with { type: "json" };

import { describeError } from "./errors.js";

export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const EXIT_OK = 0;
export const EXIT_USAGE = 2;

const HELP = `Usage: conductor [options]

Orchestrates AI agents on top of OpenCode to implement features.

Options:
  -v, --version  Print the version
  -h, --help     Print this help
`;

export function runCli(argv: readonly string[], io: CliIo): number {
  let values: { version?: boolean; help?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        version: { type: "boolean", short: "v" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error: unknown) {
    io.stderr(`${describeError(error)}\n\n${HELP}`);
    return EXIT_USAGE;
  }

  if (values.version === true) {
    io.stdout(`${pkg.version}\n`);
    return EXIT_OK;
  }

  io.stdout(HELP);
  return EXIT_OK;
}
