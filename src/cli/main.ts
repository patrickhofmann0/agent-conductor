import { parseArgs } from "node:util";

import pkg from "../../package.json" with { type: "json" };

import { initCommand } from "./commands/init.js";
import { createResumeCommand, createRunCommand } from "./commands/run.js";
import { validateConfigCommand } from "./commands/validate-config.js";
import { openOpencode } from "./engine-setup.js";
import { describeError, UsageError } from "./errors.js";

import type { CliIo, Command } from "./cli.types.js";

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

const HELP = `Usage: conductor <command> [options]

Orchestrates AI agents on top of OpenCode to implement features.

Commands:
  run --no-pr "<task>"     Start a run on a new local branch
  resume --no-pr <run-id>  Continue a paused or interrupted run
  validate-config          Check conductor.yaml in the current directory
  init                     Create a commented conductor.yaml

Options:
  --no-pr        Work on a local branch only (required until PR support exists)
  -v, --version  Print the version
  -h, --help     Print this help
`;

const COMMANDS: Readonly<Record<string, Command>> = {
  "validate-config": validateConfigCommand,
  init: initCommand,
  run: createRunCommand(openOpencode),
  resume: createResumeCommand(openOpencode),
};

const OPTIONS = {
  version: { type: "boolean", short: "v" },
  help: { type: "boolean", short: "h" },
  "no-pr": { type: "boolean" },
} as const;

function parse(
  argv: readonly string[],
): ReturnType<
  typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>
> {
  return parseArgs({
    args: [...argv],
    options: OPTIONS,
    strict: true,
    allowPositionals: true,
  });
}

export async function runCli(
  argv: readonly string[],
  io: CliIo,
): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error: unknown) {
    io.stderr(`${describeError(error)}\n\n${HELP}`);
    return EXIT_USAGE;
  }
  const { values, positionals } = parsed;
  if (values.version === true) {
    io.stdout(`${pkg.version}\n`);
    return EXIT_OK;
  }
  const [name, ...args] = positionals;
  if (values.help === true || name === undefined) {
    io.stdout(HELP);
    return EXIT_OK;
  }
  const command = COMMANDS[name];
  if (command === undefined) {
    io.stderr(`Unknown command "${name}".\n\n${HELP}`);
    return EXIT_USAGE;
  }
  try {
    return await command({ args, noPr: values["no-pr"] === true, io });
  } catch (error: unknown) {
    io.stderr(`${describeError(error)}\n`);
    return error instanceof UsageError ? EXIT_USAGE : EXIT_FAILURE;
  }
}
