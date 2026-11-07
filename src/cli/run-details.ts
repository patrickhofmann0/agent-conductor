import { formatUsd } from "../adapters/terminal/reporter.js";
import { verdictSchema } from "../core/schemas/verdict.js";

import type { RunState } from "../core/schemas/state.js";
import type { Finding } from "../core/schemas/verdict.js";

export interface RunDetails {
  readonly state: RunState;
  readonly requirements: string | null;
  readonly plan: string | null;
  /** Raw `review-<n>.json` contents, iteration 1 first. */
  readonly reviews: readonly string[];
}

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0
    ? `${String(minutes)}m ${String(seconds % 60)}s`
    : `${String(seconds)}s`;
}

function summary(state: RunState): string {
  const outcome = state.outcome === null ? "" : ` (${state.outcome})`;
  return [
    `Run ${state.runId}: ${state.status}${outcome}`,
    `Task:       ${state.input.title}`,
    `Branch:     ${state.branch}`,
    `Started:    ${new Date(state.startedAt).toISOString()}`,
    `Step:       ${state.step}, iteration ${String(state.iteration)}`,
    `Active:     ${duration(state.activeMs)}`,
    `Cost:       ${formatUsd(state.costUsd)}`,
  ].join("\n");
}

function history(state: RunState): string {
  if (state.history.length === 0) return "## History\n\nNo agent has run yet.";
  const lines = state.history.map((record) =>
    [
      `- ${record.step}`,
      record.iteration > 0 ? ` (iteration ${String(record.iteration)})` : "",
      `: ${record.status}, ${duration(record.durationMs)}, ${formatUsd(record.costUsd)}`,
    ].join(""),
  );
  return `## History\n\n${lines.join("\n")}`;
}

function document(title: string, content: string | null): string {
  const body = content?.trim() ?? "";
  return `## ${title}\n\n${body === "" ? "(not written yet)" : body}`;
}

function findingLine(finding: Finding): string {
  const line = finding.line === undefined ? "" : `:${String(finding.line)}`;
  const where = finding.file === undefined ? "" : ` ${finding.file}${line}`;
  return `- [${finding.severity}] ${finding.target}${where}: ${finding.message}`;
}

function review(raw: string, iteration: number): string {
  const title = `## Review ${String(iteration)}`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const result = verdictSchema.safeParse(parsed);
  if (!result.success) return `${title}\n\n${raw.trim()}`;
  const verdict = result.data;
  const findings =
    verdict.findings.length === 0
      ? "No findings."
      : verdict.findings.map(findingLine).join("\n");
  return `${title}\n\nVerdict: ${verdict.verdict}, route: ${verdict.route}\n\n${verdict.summary}\n\n${findings}`;
}

/** Everything about one run as Markdown-like text for the terminal. */
export function formatRunDetails(details: RunDetails): string {
  const reviews = details.reviews.map((raw, index) => review(raw, index + 1));
  return `${[
    summary(details.state),
    history(details.state),
    document("Requirements", details.requirements),
    document("Plan", details.plan),
    ...(reviews.length > 0 ? reviews : ["## Reviews\n\nNo review yet."]),
  ].join("\n\n")}\n`;
}
