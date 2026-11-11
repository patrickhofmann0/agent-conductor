import { UsageError } from "../errors.js";

import type { CommandInput } from "../cli.types.js";
import type { OpenForge } from "../forge-setup.js";
import type { Forge, Issue } from "../../core/ports/forge.types.js";
import type { RunInput } from "../../core/schemas/state.js";

/** How a command reaches humans: pull request and gates. */
export interface Publishing {
  /** The forge to publish to; null with `--no-pr`. */
  readonly forge: Forge | null;
  readonly forgeGates: boolean;
  /** Flags to repeat on `resume`, e.g. "--no-pr ". */
  readonly flags: string;
}

/** Rejects contradicting flags before anything starts. */
export function checkPublishingFlags(input: CommandInput): void {
  if (input.noPr && input.forgeGates === true) {
    throw new UsageError("--gates pr needs a pull request; drop --no-pr.");
  }
}

function flags(input: CommandInput): string {
  if (input.noPr) return "--no-pr ";
  return input.forgeGates === true ? "--gates pr " : "";
}

/** Connects to the forge unless the command works on a local branch only. */
export async function openPublishing(
  input: CommandInput,
  openForge: OpenForge,
): Promise<Publishing> {
  checkPublishingFlags(input);
  return {
    forge: input.noPr ? null : await openForge(input.io.cwd),
    forgeGates: input.forgeGates === true,
    flags: flags(input),
  };
}

export function issueInput(issue: Issue): RunInput {
  const body = issue.body.trim();
  return {
    kind: "issue",
    title: issue.title.trim(),
    body: body === "" ? issue.title.trim() : body,
    ref: issue.ref,
  };
}

/** Reads the issue, also with `--no-pr` (where no forge is open yet). */
export async function readIssue(
  ref: string,
  source: {
    readonly publishing: Publishing;
    readonly openForge: OpenForge;
    readonly directory: string;
  },
): Promise<RunInput> {
  const forge =
    source.publishing.forge ?? (await source.openForge(source.directory));
  return issueInput(await forge.getIssue(ref));
}
