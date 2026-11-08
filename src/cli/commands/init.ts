import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CONFIG_FILE } from "../config-file.js";
import { UsageError } from "../errors.js";

import type { Command } from "../cli.types.js";

export const CONFIG_TEMPLATE = `# yaml-language-server: $schema=https://raw.githubusercontent.com/patrickhofmann0/agent-conductor/main/conductor.schema.json
# conductor configuration. Every setting is optional; see docs/guide/configuration.md.
version: 1

# Language of requirements, plans and pull request texts.
language: en

# Models as "provider/model" or "provider/model#variant".
# Without a model, OpenCode's default model is used.
# models:
#   default: openai/gpt-5
#   reviewer: openai/o3

# Ask a human to approve the requirements and the plan.
gates:
  po: true
  planner: true
  final: false # set to true to give feedback before the result is finished

loop:
  maxIterations: 3
  onLimit: draft_pr # draft_pr | fail | ask

limits:
  phaseTimeout: 20m
  totalTimeout: 2h
  maxCostUsd: 10

# Commands that decide whether the result is good enough.
checks: []
#  - name: test
#    command: npm test
#    required: true
#    timeout: 10m

# Files the coder must not change (tests, linter and CI configuration).
guardrails:
  paths: []
#    - "**/*.test.ts"
#    - ".github/workflows/**"

git:
  baseBranch: main
  branchPrefix: conductor/
  commitMessage: "feat: {{title}}"
`;

/** `conductor init`: writes a commented conductor.yaml; never overwrites. */
export const initCommand: Command = async ({ args, io }) => {
  if (args.length > 0) throw new UsageError("init takes no arguments.");
  const path = join(io.cwd, CONFIG_FILE);
  try {
    await writeFile(path, CONFIG_TEMPLATE, { flag: "wx" });
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`${path} already exists; not overwriting it.`, {
        cause: error,
      });
    }
    throw error;
  }
  io.stdout(`Created ${path}.\n`);
  return 0;
};
