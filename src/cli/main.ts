import { parseArgs } from "node:util";

import pkg from "../../package.json" with { type: "json" };

import { initCommand } from "./commands/init.js";
import { createReviseCommand } from "./commands/revise.js";
import { createResumeCommand, createRunCommand } from "./commands/run.js";
import { runsCommand } from "./commands/runs.js";
import { showCommand } from "./commands/show.js";
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
  run "<task>"             Start a run on a new branch and open a pull request
  run --issue <ref>        Same, implementing a GitHub issue (owner/repo#42, #42)
  resume <run-id>          Continue a paused or interrupted run
  revise <run-id> "<feedback>"
                           Reopen a finished run and address the feedback
  runs                     List open runs in the current repository
  show <run-id>            Show a run with requirements, plan and all reviews
  validate-config          Check conductor.yaml in the current directory
  init                     Create a commented conductor.yaml

Options:
  --no-pr        Work on a local branch only, without GitHub
  --gates <where>
                 Where you answer gates: "terminal" (default) asks here;
                 "pr" pauses the run until you review the pull request,
                 then continue with resume --gates pr
  --issue <ref>  The issue to implement (run only)
  -v, --version  Print the version
  -h, --help     Print this help
`;

const COMMANDS: Readonly<Record<string, Command>> = {
  "validate-config": validateConfigCommand,
  init: initCommand,
  run: createRunCommand(openOpencode),
  resume: createResumeCommand(openOpencode),
  revise: createReviseCommand(openOpencode),
  runs: runsCommand,
  show: showCommand,
};

const OPTIONS = {
  version: { type: "boolean", short: "v" },
  help: { type: "boolean", short: "h" },
  "no-pr": { type: "boolean" },
  issue: { type: "string" },
  gates: { type: "string" },
} as const;

function forgeGates(value: string | undefined): boolean {
  if (value === undefined || value === "terminal") return false;
  if (value === "pr") return true;
  throw new UsageError(
    `Unknown value "${value}" for --gates; use terminal or pr.`,
  );
}

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
    return await command({
      args,
      noPr: values["no-pr"] === true,
      issue: values.issue,
      forgeGates: forgeGates(values.gates),
      io,
    });
  } catch (error: unknown) {
    io.stderr(`${describeError(error)}\n`);
    return error instanceof UsageError ? EXIT_USAGE : EXIT_FAILURE;
  }
}
