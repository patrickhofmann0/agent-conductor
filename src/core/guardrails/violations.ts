import { matchesAny } from "./glob.js";

import type { Finding } from "../schemas/verdict.js";

/** Framework files that no agent may change, independent of configuration. */
const ALWAYS_PROTECTED: readonly string[] = [".conductor/**"];

/**
 * The run state, which the engine rewrites after every step and therefore is
 * uncommitted while agents work. Agent edits have no effect: the engine keeps
 * the state in memory and overwrites the file after the step.
 */
const FRAMEWORK_STATE: readonly string[] = [".conductor/runs/*/state.json"];

export interface ViolationInput {
  /** Files the agent changed in this phase. */
  readonly changed: readonly string[];
  /** Guardrail globs that apply to the agent. */
  readonly patterns: readonly string[];
  /** Files the tester created or changed in this run. */
  readonly testerPaths: readonly string[];
}

/** Returns the changed files the agent was not allowed to touch, sorted. */
export function guardrailViolations(input: ViolationInput): string[] {
  const patterns = [...ALWAYS_PROTECTED, ...input.patterns];
  const testerPaths = new Set(input.testerPaths);
  return input.changed
    .filter((path) => !matchesAny(path, FRAMEWORK_STATE))
    .filter((path) => testerPaths.has(path) || matchesAny(path, patterns))
    .sort();
}

export interface ViolationFindingInput {
  readonly paths: readonly string[];
  readonly iteration: number;
  readonly target: Finding["target"];
}

export function violationFinding(input: ViolationFindingInput): Finding {
  return {
    id: `guardrail-violation-${input.target}-${String(input.iteration)}`,
    severity: "high",
    target: input.target,
    message: `The ${input.target} changed protected files, and the changes were reverted: ${input.paths.join(", ")}. Work with the existing tests, rules and framework files instead of changing them.`,
    source: "framework",
  };
}
