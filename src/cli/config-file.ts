import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse } from "yaml";

import { parseConfig } from "../core/config/parse.js";

import { describeError } from "./errors.js";

import type { Config } from "../core/schemas/config.js";

export const CONFIG_FILE = "conductor.yaml";

export const NO_CHECKS_WARNING =
  "No checks configured; only the reviewer judges the result.";

export interface LoadedConfig {
  readonly config: Config;
  /** The file that was read, or null when the defaults apply. */
  readonly path: string | null;
  readonly warnings: readonly string[];
}

/** Invalid configuration; `errors` lists one problem per entry. */
export class ConfigError extends Error {
  constructor(
    readonly path: string,
    readonly errors: readonly string[],
  ) {
    super(`Invalid ${path}:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function warningsFor(config: Config, path: string | null): string[] {
  const warnings: string[] = [];
  if (path === null) {
    warnings.push(`No ${CONFIG_FILE} found; using defaults.`);
  }
  if (config.checks.length === 0) {
    warnings.push(NO_CHECKS_WARNING);
  }
  return warnings;
}

/** Reads and validates `conductor.yaml` in `directory`; defaults if it is missing. */
export async function loadConfig(directory: string): Promise<LoadedConfig> {
  const path = join(directory, CONFIG_FILE);
  const text = await readOptional(path);
  let raw: unknown;
  try {
    raw = text === null ? undefined : parse(text);
  } catch (error: unknown) {
    throw new ConfigError(path, [describeError(error)]);
  }
  const result = parseConfig(raw);
  if (!result.ok) throw new ConfigError(path, result.errors);
  const found = text === null ? null : path;
  return {
    config: result.config,
    path: found,
    warnings: warningsFor(result.config, found),
  };
}
