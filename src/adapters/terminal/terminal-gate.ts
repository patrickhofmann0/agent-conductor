import type { Readable, Writable } from "node:stream";

import type {
  GateDecision,
  GateHandler,
  GateRequest,
  LimitDecision,
  LimitRequest,
} from "../../core/ports/gate-handler.types.js";

import { createLineReader, type LineReader } from "./lines.js";

export interface TerminalGateOptions {
  readonly input: Readable;
  readonly output: Writable;
  /** Lets the user write feedback in an editor; receives a commented template. */
  readonly edit: (template: string) => Promise<string>;
}

export interface TerminalGate extends GateHandler {
  /** Releases the input stream. */
  close(): void;
}

interface Io {
  readonly lines: LineReader;
  readonly write: (text: string) => void;
  readonly edit: (template: string) => Promise<string>;
}

const GATE_CHOICES =
  "[a]pprove, [r]evise (type feedback), [e]dit feedback in editor, [x] abort: ";
const LIMIT_CHOICES = "[c]ontinue, [d]raft PR, [x] abort: ";

async function ask(io: Io, question: string): Promise<string | undefined> {
  io.write(question);
  return (await io.lines.next())?.trim().toLowerCase();
}

async function readInlineFeedback(io: Io): Promise<string> {
  io.write("Feedback (finish with an empty line):\n");
  const lines: string[] = [];
  for (
    let line = await io.lines.next();
    line !== undefined && line !== "";
    line = await io.lines.next()
  ) {
    lines.push(line);
  }
  return lines.join("\n").trim();
}

async function editorFeedback(io: Io, request: GateRequest): Promise<string> {
  try {
    return await io.edit(
      `# Feedback for ${request.artifactName} (${request.gate} gate).\n# Lines starting with "#" are ignored.\n`,
    );
  } catch (error: unknown) {
    io.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return "";
  }
}

async function abortReason(io: Io, fallback: string): Promise<string> {
  io.write("Reason (optional): ");
  const reason = (await io.lines.next())?.trim() ?? "";
  return reason === "" ? fallback : reason;
}

async function decideGate(io: Io, request: GateRequest): Promise<GateDecision> {
  const aborted = `Aborted by the user at the ${request.gate} gate`;
  for (;;) {
    const answer = await ask(io, GATE_CHOICES);
    if (answer === undefined)
      return {
        kind: "abort",
        reason: `Input closed at the ${request.gate} gate`,
      };
    if (answer === "a") return { kind: "approve" };
    if (answer === "x")
      return { kind: "abort", reason: await abortReason(io, aborted) };
    if (answer === "r" || answer === "e") {
      const feedback =
        answer === "r"
          ? await readInlineFeedback(io)
          : await editorFeedback(io, request);
      if (feedback !== "") return { kind: "revise", feedback };
      io.write("Feedback is empty.\n");
      continue;
    }
    io.write("Please answer a, r, e or x.\n");
  }
}

async function decideLimit(io: Io): Promise<LimitDecision> {
  for (;;) {
    const answer = await ask(io, LIMIT_CHOICES);
    if (answer === undefined)
      return { kind: "abort", reason: "Input closed at a limit" };
    if (answer === "c") return { kind: "continue" };
    if (answer === "d") return { kind: "draft_pr" };
    if (answer === "x")
      return {
        kind: "abort",
        reason: await abortReason(io, "Aborted by the user at a limit"),
      };
    io.write("Please answer c, d or x.\n");
  }
}

/** Asks the human in the terminal at gates and limits (local runs). */
export function createTerminalGate(options: TerminalGateOptions): TerminalGate {
  const io: Io = {
    lines: createLineReader(options.input),
    write: (text) => {
      options.output.write(text);
    },
    edit: options.edit,
  };
  return {
    request: (request) => {
      const rule = "─".repeat(60);
      io.write(
        `\n${rule}\n${request.gate} gate: ${request.artifactName}\n${rule}\n${request.artifact.trimEnd()}\n${rule}\n`,
      );
      return decideGate(io, request);
    },
    resolveLimit: (request: LimitRequest) => {
      io.write(`\nLimit reached (${request.kind}): ${request.detail}\n`);
      return decideLimit(io);
    },
    close: () => {
      io.lines.close();
    },
  };
}
