import {
  formatCheckResults,
  formatFindings,
  joinSections,
  section,
} from "./format.js";

import type { CheckResult } from "../schemas/check-result.js";
import type { RunInput } from "../schemas/state.js";
import type { Finding } from "../schemas/verdict.js";

export interface RevisionContext {
  /** The previous version of the artifact, when a human asked for changes. */
  readonly previous?: string | null;
  readonly feedback?: string;
}

function request(input: RunInput): string {
  const source = input.ref === undefined ? "" : `Source: ${input.ref}\n\n`;
  return section("Request", `${source}# ${input.title}\n\n${input.body}`);
}

function revision(
  context: RevisionContext,
  artifactName: string,
): (string | null)[] {
  if (context.feedback === undefined) return [];
  const previous =
    context.previous === undefined || context.previous === null
      ? null
      : section(`Previous ${artifactName}`, context.previous);
  return [
    previous,
    section(
      "Human feedback",
      `${context.feedback}\n\nRevise the ${artifactName} according to this feedback.`,
    ),
  ];
}

export function productOwnerTask(
  input: RunInput,
  context: RevisionContext = {},
): string {
  return joinSections([request(input), ...revision(context, "requirements")]);
}

export interface PlannerTaskInput extends RevisionContext {
  readonly input: RunInput;
  readonly requirements: string;
}

export function plannerTask(task: PlannerTaskInput): string {
  return joinSections([
    request(task.input),
    section("Requirements", task.requirements),
    ...revision(task, "plan"),
  ]);
}

export interface ImplementationTaskInput {
  readonly requirements: string;
  readonly plan: string;
  readonly iteration: number;
  readonly findings: readonly Finding[];
  readonly checkResults: readonly CheckResult[];
}

function iterationSections(
  task: ImplementationTaskInput,
  target: Finding["target"],
): (string | null)[] {
  if (task.iteration <= 1) return [];
  const findings = task.findings.filter((finding) => finding.target === target);
  return [
    section(
      `Review findings for you (iteration ${String(task.iteration)})`,
      formatFindings(findings),
    ),
    section(
      "Check results of the previous iteration",
      formatCheckResults(task.checkResults),
    ),
  ];
}

export function coderTask(task: ImplementationTaskInput): string {
  return joinSections([
    section("Requirements", task.requirements),
    section("Plan", task.plan),
    ...iterationSections(task, "coder"),
  ]);
}

export function testerTask(task: ImplementationTaskInput): string {
  return joinSections([
    section("Requirements", task.requirements),
    section("Plan", task.plan),
    ...iterationSections(task, "tester"),
  ]);
}

export interface ReviewTaskInput {
  readonly requirements: string;
  readonly plan: string;
  readonly iteration: number;
  readonly diff: string;
  readonly checkResults: readonly CheckResult[];
  readonly violations: readonly Finding[];
}

/**
 * Without configured checks nothing executes the tests, and the reviewer may not
 * run commands. Say so, or the reviewer waits for test results that never come.
 */
const NO_CHECKS_FOR_REVIEW =
  "No automated checks are configured for this repository, and you cannot run commands. Judge the changes by reading the code and the tests. Do not withhold approval only because the tests were not executed; if unverified behavior matters, report it as a low-severity finding.";

function reviewCheckResults(results: readonly CheckResult[]): string {
  return results.length === 0
    ? NO_CHECKS_FOR_REVIEW
    : formatCheckResults(results);
}

export function reviewerTask(task: ReviewTaskInput): string {
  return joinSections([
    section("Requirements", task.requirements),
    section("Plan", task.plan),
    section(
      `Changes so far (iteration ${String(task.iteration)})`,
      `\`\`\`diff\n${task.diff}\n\`\`\``,
    ),
    section("Check results", reviewCheckResults(task.checkResults)),
    section(
      "Guardrail violations detected by the framework",
      formatFindings(task.violations),
    ),
  ]);
}

export function reviewerRetryTask(error: string): string {
  return `Your answer could not be used: ${error}\n\nAnswer again with only the JSON object in a \`\`\`json code block, in the format described in your instructions.`;
}
