import { formatCheckResults, formatFindings } from "../prompts/format.js";

import type { RunState } from "../schemas/state.js";

export interface PullRequestBodyInput {
  readonly state: RunState;
  readonly requirements: string | null;
  readonly plan: string | null;
}

function details(summary: string, content: string | null): string {
  return `<details>\n<summary>${summary}</summary>\n\n${content?.trim() ?? "(not created)"}\n\n</details>`;
}

function warning(state: RunState): string | null {
  if (!state.needsHuman) return null;
  const reason = state.outcome ?? "A limit was reached.";
  return `> [!WARNING]\n> agent-conductor stopped before the reviewer approved: ${reason}\n> A human needs to take over.`;
}

function openFindings(state: RunState): string | null {
  if (!state.needsHuman || state.findings.length === 0) return null;
  return `## Open findings\n\n${formatFindings(state.findings)}`;
}

function runTable(state: RunState): string {
  return [
    "## Run",
    "",
    "| Run ID | Iterations | Cost |",
    "| --- | --- | --- |",
    `| \`${state.runId}\` | ${String(state.iteration)} | $${state.costUsd.toFixed(2)} |`,
  ].join("\n");
}

export function renderPullRequestBody(input: PullRequestBodyInput): string {
  const { state } = input;
  return [
    warning(state),
    `## Summary\n\n${state.lastVerdict?.summary ?? "No review yet."}`,
    openFindings(state),
    `## Checks\n\n${formatCheckResults(state.checkResults)}`,
    runTable(state),
    details("Requirements", input.requirements),
    details("Plan", input.plan),
    "---\n\n_Created by agent-conductor._",
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n");
}

export function renderGateBody(artifactName: string, artifact: string): string {
  return [
    `> [!NOTE]\n> agent-conductor is waiting for approval of \`${artifactName}\`. Approve this pull request to continue, or request changes with your feedback.`,
    artifact.trim(),
  ].join("\n\n");
}

export function commitMessage(template: string, title: string): string {
  return template.replaceAll("{{title}}", title);
}
