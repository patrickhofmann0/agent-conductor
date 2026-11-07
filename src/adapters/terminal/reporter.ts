import type { Reporter, RunEvent } from "../../core/ports/reporter.types.js";

function seconds(ms: number): string {
  return `${String(Math.round(ms / 1000))}s`;
}

function iterationOf(iteration: number): string {
  return iteration > 0 ? ` (iteration ${String(iteration)})` : "";
}

function withReason(text: string, reason: string | undefined): string {
  return reason === undefined || reason === "" ? text : `${text}: ${reason}`;
}

/** One human-readable line per event. */
export function formatEvent(event: RunEvent): string {
  switch (event.type) {
    case "step_started":
      return `> ${event.step}${iterationOf(event.iteration)}`;
    case "agent_finished":
      return `  ${event.step} finished in ${seconds(event.durationMs)}, $${event.costUsd.toFixed(2)}`;
    case "guardrail_reverted":
      return `  ! reverted changes to protected files: ${event.paths.join(", ")}`;
    case "limit_reached":
      return `! limit reached (${event.kind}): ${event.detail}`;
    case "run_paused":
      return withReason("Run paused", event.reason);
    case "run_finished":
      return withReason(`Run ${event.status}`, event.reason);
  }
}

/** Writes run progress as plain text lines. */
export function createTerminalReporter(
  write: (text: string) => void,
): Reporter {
  return {
    report: (event) => {
      write(`${formatEvent(event)}\n`);
    },
  };
}
