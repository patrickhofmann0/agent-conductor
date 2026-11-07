import { loadConfig } from "../config-file.js";
import { UsageError } from "../errors.js";

import type { Command } from "../cli.types.js";

/** `conductor validate-config`: checks conductor.yaml and prints warnings. */
export const validateConfigCommand: Command = async ({ args, io }) => {
  if (args.length > 0)
    throw new UsageError("validate-config takes no arguments.");
  const loaded = await loadConfig(io.cwd);
  for (const warning of loaded.warnings) io.stderr(`warning: ${warning}\n`);
  io.stdout(`${loaded.path ?? "Default configuration"} is valid.\n`);
  return 0;
};
